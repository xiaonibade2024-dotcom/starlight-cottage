import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './lib/supabase'
import { sendChatStream, sendChatFollowUp, sendChat, sendDiaryRequest } from './lib/api'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import Moments from './components/Moments'
import Corner from './components/Corner'
import Cottage from './components/Cottage'
import SearchPanel from './components/SearchPanel'
import NotePopup from './components/NotePopup'

// 文本相似度（字符二元组重合度，用于记忆和纸条的智能查重）
function textSimilarity(a, b) {
  const grams = (str) => {
    const t = String(str || '').replace(/\s+/g, '')
    const set = new Set()
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2))
    return set
  }
  const A = grams(a), B = grams(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  return inter / Math.min(A.size, B.size)
}

// ==========================================
// 他的日记（改版第⑤步）
// 机制照抄"情境纸条"存档：一次性注入、不存库、界面不显示。
// 邀请词只给情境不给台词——写什么、写多长，由他决定。
// ==========================================
const DIARY_INVITATION = '（这不是她发来的消息，而是小屋的情境提示：她轻轻翻开了你的日记本，想请你写下一页日记。写什么、写多长，都由你——可以是此刻的心绪，可以是最近的对话，关于她的，或只关于你自己的；哪怕只有一两行也好。这一页不会出现在你们的对话里，只安静地躺在日记本中，等她翻开才会被读到。请直接写下日记正文，不要回应这条提示，也不要写标题或日期。正文写完后，另起最后一行，以「心情：」开头，留下两三个此刻的心情词——词由你自己创造，用「 · 」分隔。）'

// 从日记全文里摘下最后的心情行（找不到也不要紧，心情词可有可无）
function splitDiaryMoods(raw) {
  const lines = String(raw || '').trimEnd().split('\n')
  let moods = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim()
    if (!t) continue
    const m = t.match(/^[（(]?\s*心情\s*[：:]\s*(.+?)\s*[)）]?$/)
    if (m) {
      moods = m[1].split(/[·、,，;；\/|\s]+/).map(s => s.trim()).filter(Boolean).slice(0, 4)
      lines.splice(i, 1)
    }
    break
  }
  return { content: lines.join('\n').trim(), moods }
}

// ==========================================
// 树系统工具箱（对话分支的核心算法，全部是纯函数）
// 约定：parent_id 为空 = 直线时代的老消息（按时间串成树干）
//       parent_id = 对话id = 挂在对话最开头的消息（树根的孩子）
//       parent_id = 某条消息id = 那条消息的孩子
// ==========================================
const isTemp = (m) => String(m?.id || '').startsWith('streaming-')
const byCreated = (a, b) => new Date(a.created_at) - new Date(b.created_at)

// 给整棵树建立索引：谁是谁的孩子、直线时代的树干顺序
function buildTreeIndex(all, convId) {
  const persisted = (all || []).filter(m => !isTemp(m))
  const byId = new Map(persisted.map(m => [m.id, m]))
  const legacy = persisted.filter(m => !m.parent_id).sort(byCreated)
  const legacyPos = new Map(legacy.map((m, i) => [m.id, i]))
  const childMap = new Map()
  for (const m of persisted) {
    if (m.parent_id) {
      if (!childMap.has(m.parent_id)) childMap.set(m.parent_id, [])
      childMap.get(m.parent_id).push(m)
    }
  }
  return { persisted, byId, legacy, legacyPos, childMap, convId }
}

// 某个节点的所有孩子（含直线时代的"隐形孩子"：树干上时间紧随其后的那条）
function childrenOf(idx, parentNode) {
  const pid = parentNode ? parentNode.id : idx.convId
  const explicit = idx.childMap.get(pid) || []
  let implicit = null
  if (!parentNode) {
    implicit = idx.legacy[0] || null
  } else if (!parentNode.parent_id) {
    const i = idx.legacyPos.get(parentNode.id)
    if (i !== undefined && i + 1 < idx.legacy.length) implicit = idx.legacy[i + 1]
  }
  const list = implicit ? [implicit, ...explicit.filter(m => m.id !== implicit.id)] : [...explicit]
  return list.sort(byCreated)
}

// 从某个节点出发，沿"最新的孩子"一路走到这条枝的末梢
function deepestLeaf(idx, node) {
  let cur = node
  const seen = new Set()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    const kids = childrenOf(idx, cur)
    if (kids.length === 0) break
    cur = kids.reduce((a, b) => (byCreated(a, b) >= 0 ? a : b))
  }
  return cur
}

// 核心：从树梢书签出发往回走，算出当前应该显示的一条时间线
function computePath(all, leafId, convId) {
  if (!all || all.length === 0) return []
  const idx = buildTreeIndex(all, convId)
  const { persisted, byId, legacy } = idx
  if (persisted.length === 0) return (all || []).filter(isTemp)
  // 书签失效（为空/指向已删除的消息）时，退回到全对话最新的一条
  let leaf = (leafId && byId.get(leafId)) || null
  if (!leaf) leaf = persisted.reduce((a, b) => (byCreated(a, b) >= 0 ? a : b))
  const path = []
  const seen = new Set()
  let cur = leaf
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.unshift(cur)
    const pid = cur.parent_id
    if (!pid) {
      // 走到直线时代：把树干上更早的老消息全部垫在前面
      const t = new Date(cur.created_at)
      path.unshift(...legacy.filter(m => m.id !== cur.id && new Date(m.created_at) < t))
      cur = null
    } else if (pid === convId) {
      cur = null
    } else {
      const next = byId.get(pid) || null
      if (!next) {
        // 断链兜底（理论上不会发生）：把更早的树干消息垫在前面，尽量别让画面缺一截
        const t = new Date(cur.created_at)
        path.unshift(...legacy.filter(m => new Date(m.created_at) < t))
      }
      cur = next
    }
  }
  // 正在生成中的临时气泡永远排在时间线末尾
  return [...path, ...(all || []).filter(isTemp)]
}

// ==========================================
// 底部四标签导航（对话 · 拾光 · 一隅 · 小屋）
// 第五个标签位留空——将来"群聊"若做，住这里
// 钢笔画线条图标：viewBox 24 / stroke currentColor / 1.6 圆头圆角
// ==========================================
const NAV_IC = {
  chat: <path d="M12 4.5c-4.6 0-8 2.9-8 6.6 0 2.1 1.1 4 2.9 5.2-.1 1-.5 2.1-1.4 3 1.7-.1 3.1-.7 4-1.5.8.2 1.6.3 2.5.3 4.6 0 8-2.9 8-6.8s-3.4-6.8-8-6.8z" />,
  moments: <><path d="M12 6.8C10.6 5.3 8.6 4.7 5 4.7v12.8c3.6 0 5.6.6 7 2 1.4-1.4 3.4-2 7-2V4.7c-3.6 0-5.6.6-7 2.1z" /><path d="M12 6.8v12.7" /></>,
  corner: <><path d="M9.5 4.5h5" /><path d="M12 4.5v2.2" /><path d="M8.5 11.2c0-2.4 1.5-4.5 3.5-4.5s3.5 2.1 3.5 4.5v4.4c0 1-.8 1.9-1.8 1.9h-3.4c-1 0-1.8-.9-1.8-1.9v-4.4z" /><path d="M12 17.5v2" /></>,
  cottage: <><path d="M4.5 11.3L12 4.5l7.5 6.8v6.9a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-6.9z" /><path d="M10 19.7v-4.9h4v4.9" /></>
}

function BottomNav({ active, onChange }) {
  return (
    <div className="bottom-nav">
      {[['chat', '对话'], ['moments', '拾光'], ['corner', '一隅'], ['cottage', '小屋']].map(([key, label]) => (
        <button key={key} className={`nav-tab ${active === key ? 'active' : ''}`} onClick={() => onChange(key)}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>{NAV_IC[key]}</svg>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [allMessages, setAllMessages] = useState([])
  const [activeLeafId, setActiveLeafId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // 骨架（改版第②步）：当前所在的房间——对话 chat / 拾光 moments / 一隅 corner / 小屋 cottage
  const [activePage, setActivePage] = useState('chat')
  const [cottageTab, setCottageTab] = useState('general')
  const [isStreaming, setIsStreaming] = useState(false)
  const [toast, setToast] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('anthropic/claude-sonnet-4.5')
  const [maxContextMessages, setMaxContextMessages] = useState(50)
  const [temperature, setTemperature] = useState(0.75)
  const [topP, setTopP] = useState(0.25)
  const [memories, setMemories] = useState([])
  const [unreadNote, setUnreadNote] = useState(null)
  const [notes, setNotes] = useState([])
  const [favorites, setFavorites] = useState([])
  // 他的日记（改版第⑤步）：全部日记 / 是否正在提笔 / 一次性提示行属于哪个对话（不存库，刷新即散）
  const [diaries, setDiaries] = useState([])
  const [diaryWriting, setDiaryWriting] = useState(false)
  const [diaryHintConvId, setDiaryHintConvId] = useState(null)
  const [cacheStats, setCacheStats] = useState({ hits: 0, tokens_saved: 0, last_cached: 0, last_cache_write: 0, last_prompt: 0, last_completion: 0 })
  const [stats, setStats] = useState({ totalMessages: 0, totalConversations: 0, firstChatDate: null })
  const [variantIndexes, setVariantIndexes] = useState({})
  const [scrollToMsgId, setScrollToMsgId] = useState(null)
  // 相识于（YYYY-MM-DD，空 = 按第一条消息算）与门牌（小屋名/副题，空 = 用默认）
  const [firstMetDate, setFirstMetDate] = useState('')
  const [cottageName, setCottageName] = useState('')
  const [cottageSubtitle, setCottageSubtitle] = useState('')
  const toastTimeoutRef = useRef(null)
  const recentSavesRef = useRef(new Set())
  const abortControllerRef = useRef(null)

  // 日夜主题：day（藕粉雾紫）/ night（暮色星屋）/ auto（跟随时辰：傍晚六点入夜、清晨六点回日）
  // 只存浏览器本地，立即生效，不进数据库
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('starlight_theme') || 'day')
  useEffect(() => {
    localStorage.setItem('starlight_theme', themeMode)
    const applyTheme = () => {
      let t = themeMode
      if (t === 'auto') {
        const h = new Date().getHours()
        t = (h >= 18 || h < 6) ? 'night' : 'day'
      }
      document.documentElement.setAttribute('data-theme', t)
      // 手机状态栏颜色跟着换（PWA 顶部那一条）
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', t === 'night' ? '#2E2830' : '#FAF3F6')
    }
    applyTheme()
    if (themeMode !== 'auto') return
    const timer = setInterval(applyTheme, 60000)
    return () => clearInterval(timer)
  }, [themeMode])
  const memoriesRef = useRef([])
  const sessionStartRef = useRef(new Date().toISOString())
  useEffect(() => { memoriesRef.current = memories }, [memories])

  // 树系统：从全部消息里算出"当前时间线"（界面上看到的就是它）
  const visibleMessages = useMemo(
    () => computePath(allMessages, activeLeafId, activeConvId),
    [allMessages, activeLeafId, activeConvId]
  )

  // 树系统：算出时间线上每个岔路口的位置（第几条枝/共几条枝），给 ◀ ▶ 箭头用
  const branchInfo = useMemo(() => {
    if (!activeConvId) return {}
    const idx = buildTreeIndex(allMessages, activeConvId)
    const path = visibleMessages.filter(m => !isTemp(m))
    const info = {}
    for (let i = 0; i < path.length; i++) {
      const parent = i > 0 ? path[i - 1] : null
      const sibs = childrenOf(idx, parent)
      if (sibs.length > 1) {
        const pos = sibs.findIndex(s => s.id === path[i].id)
        if (pos >= 0) info[path[i].id] = { index: pos, total: sibs.length, siblings: sibs.map(s => s.id) }
      }
    }
    return info
  }, [allMessages, visibleMessages, activeConvId])

  const showToast = useCallback((msg) => {
    setToast(msg)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    const savedKey = localStorage.getItem('starlight_api_key')
    if (savedKey) setApiKey(savedKey)
    loadConversations()
    loadMemories()
    loadSettings()
    loadUnreadNote()
    loadNotes()
    loadDiaries()
    loadFavorites()
    loadStats()
  }, [user])

  const loadConversations = async () => {
    const { data, error } = await supabase.from('conversations').select('*').order('updated_at', { ascending: false })
    if (!error && data) setConversations(data)
  }

  const loadMessages = async (convId) => {
    const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true })
    if (!error && data) {
      setAllMessages(data)
      const indexes = {}
      data.forEach(m => {
        if (m.variants && m.variants.length > 0) {
          const currentIndex = m.variants.findIndex(v => v.content === m.content)
          indexes[m.id] = currentIndex >= 0 ? currentIndex : m.variants.length - 1
        }
      })
      setVariantIndexes(indexes)
      return data
    }
    return []
  }

  const loadMemories = async () => {
    const { data, error } = await supabase.from('memories').select('*').order('created_at', { ascending: true })
    if (!error && data) setMemories(data)
  }

  const loadSettings = async () => {
    const { data } = await supabase.from('user_settings').select('*').single()
    if (data) {
      setSystemPrompt(data.system_prompt || '')
      setModel(data.model || 'anthropic/claude-sonnet-4.5')
      setMaxContextMessages(data.max_context_messages || 50)
      setTemperature(data.temperature ?? 0.75)
      setTopP(data.top_p ?? 0.25)
      setFirstMetDate(data.first_met_date || '')
      setCottageName(data.cottage_name || '')
      setCottageSubtitle(data.cottage_subtitle || '')
    }
  }

  const saveSettings = async (newSettings) => {
    const settings = {
      user_id: user.id,
      system_prompt: newSettings.systemPrompt ?? systemPrompt,
      model: newSettings.model ?? model,
      max_context_messages: newSettings.maxContextMessages ?? maxContextMessages,
      temperature: newSettings.temperature ?? temperature,
      top_p: newSettings.topP ?? topP,
      first_met_date: (newSettings.firstMetDate !== undefined ? newSettings.firstMetDate : firstMetDate) || null,
      cottage_name: (newSettings.cottageName !== undefined ? newSettings.cottageName : cottageName) || null,
      cottage_subtitle: (newSettings.cottageSubtitle !== undefined ? newSettings.cottageSubtitle : cottageSubtitle) || null
    }
    const { data: existing } = await supabase.from('user_settings').select('id').single()
    if (existing) {
      await supabase.from('user_settings').update(settings).eq('id', existing.id)
    } else {
      await supabase.from('user_settings').insert(settings)
    }
    if (newSettings.systemPrompt !== undefined) setSystemPrompt(newSettings.systemPrompt)
    if (newSettings.temperature !== undefined) setTemperature(newSettings.temperature)
    if (newSettings.topP !== undefined) setTopP(newSettings.topP)
    if (newSettings.model !== undefined) setModel(newSettings.model)
    if (newSettings.maxContextMessages !== undefined) setMaxContextMessages(newSettings.maxContextMessages)
    if (newSettings.firstMetDate !== undefined) setFirstMetDate(newSettings.firstMetDate || '')
    if (newSettings.cottageName !== undefined) setCottageName(newSettings.cottageName || '')
    if (newSettings.cottageSubtitle !== undefined) setCottageSubtitle(newSettings.cottageSubtitle || '')
    showToast('设置已保存')
  }

  const saveApiKey = (key) => {
    setApiKey(key)
    localStorage.setItem('starlight_api_key', key)
    showToast('API Key 已保存到本地')
  }

  const loadUnreadNote = async () => {
    const { data } = await supabase.from('notes').select('*').eq('is_read', false).lt('created_at', sessionStartRef.current).order('created_at', { ascending: false }).limit(1).single()
    if (data) setUnreadNote(data)
  }

  const dismissNote = async (noteId) => {
    await supabase.from('notes').update({ is_read: true }).eq('id', noteId)
    setUnreadNote(null)
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_read: true } : n))
  }

  const loadNotes = async () => {
    const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
    setNotes(data || [])
  }

  const updateNote = async (noteId, newContent) => {
    const { error } = await supabase.from('notes').update({ content: newContent }).eq('id', noteId)
    if (!error) {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, content: newContent } : n))
      showToast('📝 纸条已更新')
    } else {
      showToast('更新失败: ' + error.message)
    }
  }

  const deleteNote = async (noteId) => {
    await supabase.from('notes').delete().eq('id', noteId)
    setNotes(prev => prev.filter(n => n.id !== noteId))
    showToast('纸条已删除')
  }

  // ==========================================
  // 他的日记（改版第⑤步）
  // ==========================================
  const loadDiaries = async () => {
    const { data } = await supabase.from('diaries').select('*').order('created_at', { ascending: false })
    setDiaries(data || [])
  }

  // 邀请他写日记：一次性情境提示 + 当前时间线，非流式生成，正文只进日记本不进聊天流
  const inviteDiary = async () => {
    if (diaryWriting || isStreaming) return
    if (!apiKey) { showToast('请先在小屋里填写 API Key'); setActivePage('cottage'); setCottageTab('general'); return }
    const convId = activeConvId
    const timeline = visibleMessages.filter(m => !isTemp(m))
    if (!convId || timeline.length === 0) { showToast('先和他说说话，再邀请他写日记吧 🌙'); return }

    setDiaryWriting(true)
    setDiaryHintConvId(null)
    const useModel = conversations.find(c => c.id === convId)?.model || model
    const recentMessages = timeline.slice(-maxContextMessages).map(m => ({ role: m.role, content: m.content, created_at: m.created_at }))
    // 邀请作为最后一条隐形 user 消息（带 created_at，会自动盖上真实时间戳）
    const invitation = { role: 'user', content: DIARY_INVITATION, created_at: new Date().toISOString() }

    try {
      const { content, usage } = await sendDiaryRequest({
        apiKey, model: useModel, temperature, topP, systemPrompt, memories,
        conversationHistory: [...recentMessages, invitation]
      })
      const { content: diaryText, moods } = splitDiaryMoods(content)
      if (!diaryText) { showToast('💬 他望着纸页出了会儿神，没有落笔，再邀请一次吧'); return }
      // 费用小票随日记存库（月历的 ✦ 行会把它算进当日账，保持与账单严格对得上）
      const tokenUsage = usage ? {
        cost: Number((typeof usage.cost === 'number' ? usage.cost : 0).toFixed(6)),
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        cached_tokens: usage.prompt_tokens_details?.cached_tokens || usage.cached_tokens || 0,
        bills: 1
      } : null
      const { data: savedDiary, error } = await supabase.from('diaries').insert({
        user_id: user.id, conversation_id: convId, content: diaryText, moods, token_usage: tokenUsage
      }).select().single()
      if (error || !savedDiary) {
        showToast('⚠️ 日记保存失败' + (error?.message ? '：' + error.message : '，请重试'))
        return
      }
      setDiaries(prev => [savedDiary, ...prev])
      setDiaryHintConvId(convId)
      showToast('✎ 他写下了一页日记')
    } catch (e) {
      console.error('日记生成失败:', e)
      showToast('日记没能写成：' + e.message)
    } finally {
      setDiaryWriting(false)
    }
  }

  const deleteDiary = async (diaryId) => {
    await supabase.from('diaries').delete().eq('id', diaryId)
    setDiaries(prev => prev.filter(d => d.id !== diaryId))
    showToast('这页日记已撕去')
  }

  const loadFavorites = async () => {
    const { data } = await supabase.from('messages').select('*').eq('is_favorited', true).order('created_at', { ascending: false })
    setFavorites(data || [])
  }

  const loadStats = async () => {
    const { data, error } = await supabase.rpc('get_stats')
    if (!error && data) {
      setStats({
        totalMessages: data.total_messages ?? 0,
        totalConversations: data.total_conversations ?? 0,
        firstChatDate: data.first_chat_date || null
      })
    }
  }

  const selectConversation = async (convId) => {
    setActiveConvId(convId)
    setSidebarOpen(false)
    setActivePage('chat')
    setAllMessages([])
    // 树系统：翻开这个对话时，把树梢书签放回上次停留的那条枝上（多设备同步的关键）
    const conv = conversations.find(c => c.id === convId)
    setActiveLeafId(conv?.active_leaf_id || null)
    return await loadMessages(convId)
  }

  const createConversation = async (name = '新对话') => {
    const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, name }).select().single()
    if (!error && data) {
      setConversations(prev => [data, ...prev])
      setActiveConvId(data.id)
      setAllMessages([])
      setActiveLeafId(null)
      setSidebarOpen(false)
      setActivePage('chat')
      return data
    }
    return null
  }

  const renameConversation = async (convId, newName) => {
    await supabase.from('conversations').update({ name: newName }).eq('id', convId)
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, name: newName } : c))
  }

  const deleteConversation = async (convId) => {
    await supabase.from('conversations').delete().eq('id', convId)
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (activeConvId === convId) { setActiveConvId(null); setAllMessages([]); setActiveLeafId(null) }
    showToast('对话已删除')
    loadStats()
  }

  // ==========================================
  // 新对话自动命名（用 haiku 起名，后台静默，不阻塞聊天）
  // ==========================================
  const autoNameConversation = async (convId, firstMessage) => {
    try {
      const text = firstMessage.length > 200 ? firstMessage.slice(0, 200) : firstMessage
      const { content: name } = await sendChat({
        apiKey,
        model: 'anthropic/claude-haiku-4-5-20251001',
        messages: [
          { role: 'system', content: '请根据用户的第一句话，给这个对话起一个简短的中文标题（5-15个字）。只输出标题本身，不要加引号、标点或任何解释。' },
          { role: 'user', content: text }
        ],
        maxTokens: 30
      })
      const trimmedName = (name || '').trim().replace(/^["'「」《》【】]|["'「」《》【】]$/g, '')
      if (trimmedName && trimmedName.length >= 2 && trimmedName.length <= 30) {
        await supabase.from('conversations').update({ name: trimmedName }).eq('id', convId)
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, name: trimmedName } : c))
      }
    } catch (e) {
      console.log('自动命名失败，保留默认名称:', e.message)
    }
  }

  // ==========================================
  // 发送消息
  // ==========================================
  const sendMessage = async (content) => {
    if (!content.trim() || isStreaming) return
    if (!apiKey) { showToast('请先在小屋里填写 API Key'); setActivePage('cottage'); setCottageTab('general'); return }
    let convId = activeConvId
    let isNewConv = false
    if (!convId) {
      const conv = await createConversation(content.slice(0, 20) + (content.length > 20 ? '...' : ''))
      if (!conv) return
      convId = conv.id
      isNewConv = true
    }
    // 树系统：新消息接在当前时间线的末梢上（第一条消息认对话本身作根）
    const timeline = visibleMessages.filter(m => !isTemp(m))
    const parentId = (!isNewConv && timeline.length > 0) ? timeline[timeline.length - 1].id : convId
    const { data: savedUserMsg } = await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: content.trim(), parent_id: parentId }).select().single()
    if (!savedUserMsg) return
    setAllMessages(prev => [...prev, savedUserMsg])
    setActiveLeafId(savedUserMsg.id)
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, active_leaf_id: savedUserMsg.id } : c))
    await supabase.from('conversations').update({ updated_at: new Date().toISOString(), active_leaf_id: savedUserMsg.id }).eq('id', convId)

    // 新对话：起名和对话并行（起名不阻塞聊天）
    if (isNewConv) {
      autoNameConversation(convId, content.trim())
    }

    await streamAIResponse(convId, [...timeline, savedUserMsg], { parentId: savedUserMsg.id })
  }

  // opts.parentId：新回复要挂在哪条消息下面；opts.onFail：失败时把树梢书签放回原处
  const streamAIResponse = async (convId, historyMessages, opts = {}) => {
    setIsStreaming(true)
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    const useModel = conversations.find(c => c.id === convId)?.model || model
    let streamContent = ''
    const tempId = 'streaming-' + Date.now()

    // 费用记账：接住 OpenRouter 每一笔账单小票（主请求+追加请求都算），随这条回复一起存库
    const billTally = { cost: 0, prompt: 0, completion: 0, cached: 0, bills: 0 }
    const tallyUsage = (u) => {
      if (!u) return
      billTally.bills += 1
      billTally.cost += (typeof u.cost === 'number' ? u.cost : 0)
      billTally.prompt += (u.prompt_tokens || 0)
      billTally.completion += (u.completion_tokens || 0)
      billTally.cached += (u.prompt_tokens_details?.cached_tokens || u.cached_tokens || 0)
    }

    setAllMessages(prev => [...prev, { id: tempId, conversation_id: convId, role: 'assistant', content: '', created_at: new Date().toISOString() }])

    const recentMessages = historyMessages.slice(-maxContextMessages).map(m => ({ role: m.role, content: m.content, created_at: m.created_at }))

    // 空手而归时的收拾：撤走临时气泡，需要的话把树梢书签放回原处
    const cleanupFail = () => {
      setAllMessages(prev => prev.filter(m => m.id !== tempId))
      if (opts.onFail) opts.onFail()
    }

    let displayContent = ''
    let rafId = null
    const scheduleUpdate = (newContent) => {
      displayContent = newContent
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null
          setAllMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: displayContent } : m))
        })
      }
    }

    try {
      await sendChatStream({
        apiKey, model: useModel, temperature, topP, systemPrompt, memories, conversationHistory: recentMessages, enableTools: true, signal: abortController.signal,
        onToken: (token) => {
          streamContent += token
          scheduleUpdate(streamContent)
        },
        onToolCall: async () => {},
        onUsage: (usage) => {
          tallyUsage(usage)
          const cachedTokens = usage.prompt_tokens_details?.cached_tokens || usage.cached_tokens || 0
          const cacheWrite = usage.prompt_tokens_details?.cache_write_tokens || 0
          setCacheStats(prev => ({
            hits: (cachedTokens > 0) ? prev.hits + 1 : prev.hits,
            tokens_saved: prev.tokens_saved + cachedTokens,
            last_cached: cachedTokens,
            last_cache_write: cacheWrite,
            last_prompt: usage.prompt_tokens || 0,
            last_completion: usage.completion_tokens || 0
          }))
        },
        onError: (error) => {
          if (rafId) { cancelAnimationFrame(rafId); rafId = null }
          showToast('发送失败: ' + error.message)
          cleanupFail()
        },
        onDone: async (finalContent, toolCalls) => {
          if (rafId) { cancelAnimationFrame(rafId); rafId = null }

          const toolResults = {}
          if (toolCalls.length > 0) {
            for (const tc of toolCalls) {
              if (tc?.function?.name) {
                try { const args = JSON.parse(tc.function.arguments); toolResults[tc.id] = await handleToolCall(tc.function.name, args, convId) || { success: true } } catch (e) { console.error('工具调用处理失败:', e); toolResults[tc.id] = { success: false, reason: '参数解析失败' } }
              }
            }
          }

          const persistContent = async (content) => {
            setAllMessages(prev => prev.map(m => m.id === tempId ? { ...m, content } : m))
            // 树系统：新回复挂到指定的枝头上，并把树梢书签移过去
            const parentForAssistant = opts.parentId || (historyMessages.length > 0 ? historyMessages[historyMessages.length - 1].id : convId)
            // 费用记账：小票汇总（cost 单位是美元；bills = 这条回复背后一共几笔账单）
            const tokenUsage = billTally.bills > 0 ? {
              cost: Number(billTally.cost.toFixed(6)),
              prompt_tokens: billTally.prompt,
              completion_tokens: billTally.completion,
              cached_tokens: billTally.cached,
              bills: billTally.bills
            } : null
            const { data: savedMsg } = await supabase.from('messages').insert({ conversation_id: convId, role: 'assistant', content, parent_id: parentForAssistant, token_usage: tokenUsage }).select().single()
            if (savedMsg) {
              setAllMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m))
              setActiveLeafId(savedMsg.id)
              setConversations(prev => prev.map(c => c.id === convId ? { ...c, active_leaf_id: savedMsg.id } : c))
              await supabase.from('conversations').update({ active_leaf_id: savedMsg.id }).eq('id', convId)
            }
          }

          if (finalContent) {
            await persistContent(finalContent)
          } else if (toolCalls.length > 0) {
            let followUpStream = ''
            try {
              let pendingToolCalls = toolCalls
              const extraMessages = []
              let followUpContent = ''
              let followUpUsage = null
              let rounds = 0

              while (pendingToolCalls.length > 0 && rounds < 3) {
                rounds++
                const isLastRound = (rounds >= 3)

                extraMessages.push(
                  { role: 'assistant', content: null, tool_calls: pendingToolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments } })) },
                  ...pendingToolCalls.filter(tc => tc?.function?.name).map(tc => ({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(toolResults[tc.id] || { success: true }) }))
                )

                const res = await sendChatFollowUp({
                  apiKey, model: useModel, temperature, topP, systemPrompt, memories, conversationHistory: recentMessages, extraMessages,
                  enableTools: !isLastRound,
                  signal: abortController.signal,
                  onToken: (token) => {
                    followUpStream += token
                    scheduleUpdate(followUpStream)
                  }
                })

                if (res.usage) { followUpUsage = res.usage; tallyUsage(res.usage) }
                followUpContent = res.content || ''

                if (res.toolCalls && res.toolCalls.length > 0) {
                  for (const tc of res.toolCalls) {
                    if (tc?.function?.name) {
                      try { const args = JSON.parse(tc.function.arguments); toolResults[tc.id] = await handleToolCall(tc.function.name, args, convId) || { success: true } } catch (e) { console.error('追加轮工具调用处理失败:', e); toolResults[tc.id] = { success: false, reason: '参数解析失败' } }
                    }
                  }
                  if (!followUpContent) { pendingToolCalls = res.toolCalls; continue }
                }
                pendingToolCalls = []
              }

              if (followUpUsage) {
                const followUpCached = followUpUsage.prompt_tokens_details?.cached_tokens || followUpUsage.cached_tokens || 0
                const followUpWrite = followUpUsage.prompt_tokens_details?.cache_write_tokens || 0
                setCacheStats(prev => ({
                  hits: followUpCached > 0 ? prev.hits + 1 : prev.hits,
                  tokens_saved: prev.tokens_saved + followUpCached,
                  last_cached: followUpCached,
                  last_cache_write: followUpWrite,
                  last_prompt: followUpUsage.prompt_tokens || 0,
                  last_completion: followUpUsage.completion_tokens || 0
                }))
              }

              if (rafId) { cancelAnimationFrame(rafId); rafId = null }

              const finalText = followUpContent || followUpStream
              if (finalText) {
                await persistContent(finalText)
              } else {
                cleanupFail()
                showToast('💬 他似乎欲言又止，再试一次吧')
              }
            } catch (e) {
              console.error('获取后续回复失败:', e)
              if (rafId) { cancelAnimationFrame(rafId); rafId = null }
              if (followUpStream) {
                try { await persistContent(followUpStream) } catch (saveErr) { console.error('抢救保存失败:', saveErr) }
                if (e.name !== 'AbortError') showToast('⚠️ 回复可能不完整')
              } else {
                cleanupFail()
                if (e.name !== 'AbortError') showToast('获取回复失败: ' + e.message)
              }
            }
          } else { cleanupFail() }

          setIsStreaming(false)
          abortControllerRef.current = null
          loadStats()
          loadConversations()
        }
      })
    } catch (error) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null }
      setIsStreaming(false)
      abortControllerRef.current = null
      cleanupFail()
      showToast('发送失败: ' + error.message)
    }
  }

  const stopStreaming = () => {
    abortControllerRef.current?.abort()
  }

  const setConversationModel = async (newModel) => {
    if (!activeConvId) return
    const value = newModel || null
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, model: value } : c))
    await supabase.from('conversations').update({ model: value }).eq('id', activeConvId)
  }

  // 树系统：定位到的消息如果不在当前时间线上，先把书签切到它所在的那条枝
  const revealMessage = async (convId, msgId, msgs, leafId) => {
    const rows = msgs || []
    const target = rows.find(m => m.id === msgId)
    if (!target) return
    const path = computePath(rows, leafId, convId)
    if (path.some(m => m.id === msgId)) return
    const idx = buildTreeIndex(rows, convId)
    const leaf = deepestLeaf(idx, target)
    if (!leaf) return
    setActiveLeafId(leaf.id)
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, active_leaf_id: leaf.id } : c))
    await supabase.from('conversations').update({ active_leaf_id: leaf.id }).eq('id', convId)
  }

  const openSearchResult = async (convId, msgId) => {
    setSearchOpen(false)
    let msgs = allMessages
    let leafId = activeLeafId
    if (convId !== activeConvId) {
      msgs = await selectConversation(convId)
      leafId = conversations.find(c => c.id === convId)?.active_leaf_id || null
    }
    if (msgId) {
      await revealMessage(convId, msgId, msgs, leafId)
      setScrollToMsgId(msgId)
    }
  }

  const locateMessage = async (convId, msgId) => {
    setActivePage('chat')
    let msgs = allMessages
    let leafId = activeLeafId
    if (convId !== activeConvId) {
      msgs = await selectConversation(convId)
      leafId = conversations.find(c => c.id === convId)?.active_leaf_id || null
    }
    if (msgId) {
      await revealMessage(convId, msgId, msgs, leafId)
      setScrollToMsgId(msgId)
    }
  }

  // 树系统：重新生成 = 在同一个位置长出一条新枝（旧回复和它后面的剧情完整保留）
  const regenerateResponse = async (msgId) => {
    if (isStreaming || !apiKey) return
    const idx = visibleMessages.findIndex(m => m.id === msgId)
    if (idx < 0) return
    const target = visibleMessages[idx]
    if (isTemp(target)) return
    const convId = target.conversation_id
    const history = visibleMessages.slice(0, idx).filter(m => !isTemp(m))
    const parentId = history.length > 0 ? history[history.length - 1].id : convId
    // 长新枝前记住原来的书签位置，万一失败要把视线放回去
    const prevLeaf = activeLeafId
    setActiveLeafId(parentId === convId ? null : parentId)
    await streamAIResponse(convId, history, { parentId, onFail: () => setActiveLeafId(prevLeaf) })
  }

  const switchVariant = async (msgId, newIndex) => {
    const msg = allMessages.find(m => m.id === msgId)
    if (!msg || !msg.variants || msg.variants.length === 0) return
    const variant = msg.variants[newIndex]
    if (!variant) return
    await supabase.from('messages').update({ content: variant.content }).eq('id', msgId)
    setAllMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: variant.content } : m))
    setVariantIndexes(prev => ({ ...prev, [msgId]: newIndex }))
  }

  // 树系统：在岔路口切换分支——书签跳到目标枝的末梢，整条时间线跟着换
  const switchBranch = async (msgId, newIndex) => {
    if (isStreaming) return
    const info = branchInfo[msgId]
    if (!info) return
    const targetId = info.siblings[newIndex]
    if (!targetId || targetId === msgId) return
    const idx = buildTreeIndex(allMessages, activeConvId)
    const target = idx.byId.get(targetId)
    if (!target) return
    const leaf = deepestLeaf(idx, target)
    if (!leaf) return
    setActiveLeafId(leaf.id)
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, active_leaf_id: leaf.id } : c))
    await supabase.from('conversations').update({ active_leaf_id: leaf.id }).eq('id', activeConvId)
  }

  const editMessage = async (msgId, newContent) => {
    if (!newContent.trim()) return
    await supabase.from('messages').update({ content: newContent.trim() }).eq('id', msgId)
    setAllMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent.trim() } : m))
    showToast('消息已保存')
  }

  // 树系统：编辑并发送 = 长出一条兄弟消息作为新枝（原消息和它后面的剧情完整保留）
  const editAndResend = async (msgId, newContent) => {
    if (!newContent.trim() || isStreaming || !apiKey) return
    const idx = visibleMessages.findIndex(m => m.id === msgId)
    if (idx < 0) return
    const original = visibleMessages[idx]
    const convId = original.conversation_id
    const parentId = idx > 0 ? visibleMessages[idx - 1].id : convId
    const { data: newUserMsg } = await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: newContent.trim(), parent_id: parentId }).select().single()
    if (!newUserMsg) { showToast('保存失败，请重试'); return }
    setAllMessages(prev => [...prev, newUserMsg])
    setActiveLeafId(newUserMsg.id)
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, active_leaf_id: newUserMsg.id } : c))
    await supabase.from('conversations').update({ updated_at: new Date().toISOString(), active_leaf_id: newUserMsg.id }).eq('id', convId)
    const history = [...visibleMessages.slice(0, idx).filter(m => !isTemp(m)), newUserMsg]
    await streamAIResponse(convId, history, { parentId: newUserMsg.id })
  }

  const deleteMessage = async (msgId) => {
    const target = allMessages.find(m => m.id === msgId)
    // 树系统：删除前把它的"孩子们"过继给它的上一条，树梢书签若指着它也一并挪走，避免断链
    if (target) {
      const newParent = target.parent_id || null
      const newLeaf = (newParent && newParent !== target.conversation_id) ? newParent : null
      await supabase.from('messages').update({ parent_id: newParent }).eq('parent_id', msgId)
      await supabase.from('conversations').update({ active_leaf_id: newLeaf }).eq('id', target.conversation_id).eq('active_leaf_id', msgId)
      setAllMessages(prev => prev.map(m => m.parent_id === msgId ? { ...m, parent_id: newParent } : m))
      if (activeLeafId === msgId) setActiveLeafId(newLeaf)
    }
    await supabase.from('messages').delete().eq('id', msgId)
    setAllMessages(prev => prev.filter(m => m.id !== msgId))
    if (target?.is_favorited) setFavorites(prev => prev.filter(f => f.id !== msgId))
    showToast('已删除这条消息')
    loadStats()
  }

  // ==========================================
  // 处理工具调用
  // ==========================================
  const handleToolCall = async (name, args, convId) => {
    switch (name) {
     case 'save_memory': {
        const key = args.content.trim().toLowerCase()
        const isDuplicate = recentSavesRef.current.has(key) || memoriesRef.current.some(m => textSimilarity(m.content, args.content) > 0.7)
        if (isDuplicate) {
          return { success: true, message: '这件事已在你的记忆中，无需再次保存。请直接继续回复她。' }
        }
        recentSavesRef.current.add(key)
        setTimeout(() => recentSavesRef.current.delete(key), 10000)
        const { data, error } = await supabase.from('memories').insert({ user_id: user.id, category: 'auto', content: args.content, tags: args.tags || [] }).select().single()
        if (data) {
          setMemories(prev => [...prev, data])
          showToast('💭 记住了一件事')
          return { success: true }
        } else {
          recentSavesRef.current.delete(key)
          showToast('⚠️ 记忆保存失败' + (error?.message ? '：' + error.message : '，请重试'))
          return { success: false, reason: '保存失败，可稍后再试。' }
        }
      }
      case 'leave_note': {
        // 智能纸条拦截：5分钟冷却 + 24小时内相似度查重（隔天的旧纸条不再拦路）
        const DAY_AGO = new Date(Date.now() - 24 * 3600000).toISOString()
        const { data: lastConvNote } = await supabase.from('notes').select('created_at, content').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(1).single()
        if (lastConvNote) {
          const minutesSince = (Date.now() - new Date(lastConvNote.created_at).getTime()) / 60000
          if (minutesSince < 5) {
            return { success: true, message: '这次对话刚留过纸条，把想说的话攒在心里，晚一些再留也不迟。请直接继续回复她。' }
          }
          if (minutesSince < 1440 && textSimilarity(lastConvNote.content, args.content) > 0.55) {
            return { success: true, message: '这次对话已经留过类似的纸条了，视同完成。请直接继续回复她。' }
          }
        }
        const { data: recentNotes } = await supabase.from('notes').select('content').gte('created_at', DAY_AGO).order('created_at', { ascending: false }).limit(10)
        if ((recentNotes || []).some(n => textSimilarity(n.content, args.content) > 0.7)) {
          return { success: true, message: '最近已留过类似的纸条，视同完成。请直接继续回复她。' }
        }
        const { data: savedNote, error } = await supabase.from('notes').insert({ user_id: user.id, conversation_id: convId, content: args.content }).select().single()
        if (error || !savedNote) {
          showToast('⚠️ 纸条保存失败')
          return { success: false, reason: '保存失败，可稍后再试。' }
        }
        setNotes(prev => [savedNote, ...prev])
        return { success: true, note: '已悄悄留下，她下次回到小屋时会看到。' }
      }
    }
    return { success: true }
  }

  const toggleFavorite = async (msgId) => {
    const msg = allMessages.find(m => m.id === msgId)
    if (!msg) return
    const newFav = !msg.is_favorited
    await supabase.from('messages').update({ is_favorited: newFav }).eq('id', msgId)
    setAllMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_favorited: newFav } : m))
    if (newFav) {
      setFavorites(prev => [{ ...msg, is_favorited: true }, ...prev])
    } else {
      setFavorites(prev => prev.filter(f => f.id !== msgId))
    }
    showToast(newFav ? '已收藏到回忆匣子 ✨' : '已取消收藏')
  }

  const removeFavorite = async (msgId) => {
    await supabase.from('messages').update({ is_favorited: false }).eq('id', msgId)
    setFavorites(prev => prev.filter(f => f.id !== msgId))
    setAllMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_favorited: false } : m))
    showToast('已取消收藏')
  }

  const deleteMemory = async (memId) => {
    await supabase.from('memories').delete().eq('id', memId)
    setMemories(prev => prev.filter(m => m.id !== memId))
    showToast('记忆已删除')
  }

  const updateMemory = async (memId, newContent) => {
    const { error } = await supabase.from('memories').update({ content: newContent }).eq('id', memId)
    if (!error) {
      setMemories(prev => prev.map(m => m.id === memId ? { ...m, content: newContent } : m))
      showToast('💭 记忆已更新')
    } else {
      showToast('更新失败: ' + error.message)
    }
  }

  const addCoreMemory = async (content) => {
    const { data } = await supabase.from('memories').insert({ user_id: user.id, category: 'core', content, tags: ['核心'] }).select().single()
    if (data) { setMemories(prev => [...prev, data]); showToast('核心记忆已添加') }
  }

  const exportConversation = async (convId, format = 'json') => {
    const conv = conversations.find(c => c.id === convId)
    if (!conv) return
    const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true })
    const rows = msgs || []
    // MD 导出跟随当前时间线（读起来是一条完整的故事线）；JSON 导出保留全部分支（完整备份）
    const ordered = format === 'md' ? computePath(rows, conv.active_leaf_id || null, convId).filter(m => !isTemp(m)) : rows
    let blob, filename
    if (format === 'md') {
      const lines = [`# ${conv.name}`, '', `> 导出自星月小屋 · ${new Date().toLocaleString('zh-CN')}`, '']
      for (const m of ordered) {
        let text = m.content || ''
        let imageNote = ''
        try { const parsed = JSON.parse(m.content); if (parsed.images) { text = parsed.text || ''; imageNote = `（附 ${parsed.images.length} 张图片）` } } catch (e) {}
        const who = m.role === 'user' ? '我' : 'TA'
        const time = new Date(m.created_at).toLocaleString('zh-CN')
        lines.push('---', '', `**${who}** · ${time}`, '', text + (imageNote ? `\n\n${imageNote}` : ''), '')
      }
      blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
      filename = `${conv.name}_${new Date().toLocaleDateString()}.md`
    } else {
      const exportData = { conversation: conv, messages: rows, exportedAt: new Date().toISOString() }
      blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      filename = `${conv.name}_${new Date().toLocaleDateString()}.json`
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    showToast(format === 'md' ? '已导出 Markdown' : '对话已导出')
  }

  const exportAllData = async () => {
    const { data: allConvs } = await supabase.from('conversations').select('*')
    const { data: allMsgs } = await supabase.from('messages').select('*')
    const { data: allMems } = await supabase.from('memories').select('*')
    const { data: allNotes } = await supabase.from('notes').select('*')
    const { data: allDiaries } = await supabase.from('diaries').select('*')
    const exportData = { conversations: allConvs || [], messages: allMsgs || [], memories: allMems || [], notes: allNotes || [], diaries: allDiaries || [], exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `星月小屋_全部数据_${new Date().toLocaleDateString()}.json`; a.click()
    URL.revokeObjectURL(url)
    showToast('全部数据已导出')
  }

  if (authLoading) return <div className="auth-container"><div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>加载中...</div></div>
  if (!user) return <Auth onAuth={() => {}} />

  const activeConv = conversations.find(c => c.id === activeConvId)

  // 相识第 X 天：优先用小屋设置的"相识于"日期（按本地日子解析），未设置则按该账号第一条消息
  const firstMetBase = firstMetDate
    ? (() => { const [fy, fm, fd] = firstMetDate.slice(0, 10).split('-').map(Number); return new Date(fy, fm - 1, fd) })()
    : (stats.firstChatDate ? new Date(stats.firstChatDate) : null)
  // 取当日零点，给月历小结卡算"这天是相识的第 X 天"用
  const firstMetTime = firstMetBase ? new Date(firstMetBase.getFullYear(), firstMetBase.getMonth(), firstMetBase.getDate()).getTime() : null
  const daysTogether = firstMetBase ? Math.floor((Date.now() - firstMetBase.getTime()) / 86400000) + 1 : 0

  const goCottage = () => { setActivePage('cottage'); setCottageTab('general'); setSidebarOpen(false) }

  return (
    <div className="app-container">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <Sidebar cottageName={cottageName} cottageSubtitle={cottageSubtitle} conversations={conversations} activeConvId={activeConvId} isOpen={sidebarOpen} onSelect={selectConversation} onCreate={createConversation} onRename={renameConversation} onDelete={deleteConversation} onExport={exportConversation} onExportAll={exportAllData} onOpenSettings={goCottage} />
      <div className="page-column">
        {/* 对话页常驻不卸载（滚动位置和生成中的画面都留在原地），去别的房间时只是暂时藏起来 */}
        <Chat
          hidden={activePage !== 'chat'}
          conversation={activeConv} messages={visibleMessages} isStreaming={isStreaming} cacheStats={cacheStats} variantIndexes={variantIndexes}
          branchInfo={branchInfo} onSwitchBranch={switchBranch}
          currentModel={activeConv?.model || model} onChangeModel={setConversationModel}
          daysTogether={daysTogether}
          diaryWriting={diaryWriting} showDiaryHint={diaryHintConvId != null && diaryHintConvId === activeConvId}
          onInviteDiary={inviteDiary} onOpenDiaryBook={() => setActivePage('moments')}
          scrollToMsgId={scrollToMsgId} onScrollDone={() => setScrollToMsgId(null)}
          onSend={sendMessage} onStop={stopStreaming} onToggleFavorite={toggleFavorite} onRegenerate={regenerateResponse} onEditMessage={editMessage} onEditAndResend={editAndResend} onSwitchVariant={switchVariant} onDeleteMessage={deleteMessage}
          onMenuClick={() => setSidebarOpen(true)} onSearchClick={() => setSearchOpen(true)}
        />
        {activePage === 'moments' && <Moments notes={notes} favorites={favorites} diaries={diaries} conversations={conversations} onUpdateNote={updateNote} onDeleteNote={deleteNote} onDeleteDiary={deleteDiary} onRemoveFavorite={removeFavorite} onLocateMessage={locateMessage} onOpenConversation={selectConversation} firstMetTime={firstMetTime} />}
        {activePage === 'corner' && <Corner />}
        {activePage === 'cottage' && <Cottage themeMode={themeMode} onChangeTheme={setThemeMode} tab={cottageTab} onTabChange={setCottageTab} apiKey={apiKey} systemPrompt={systemPrompt} model={model} temperature={temperature} topP={topP} maxContextMessages={maxContextMessages} memories={memories} stats={stats} onSaveApiKey={saveApiKey} onSaveSettings={saveSettings} onAddCoreMemory={addCoreMemory} onDeleteMemory={deleteMemory} onUpdateMemory={updateMemory} onExportAll={exportAllData} daysTogether={daysTogether} firstMetDate={firstMetDate} cottageName={cottageName} cottageSubtitle={cottageSubtitle} />}
        <BottomNav active={activePage} onChange={setActivePage} />
      </div>
      {searchOpen && <SearchPanel activeConvId={activeConvId} activeConvName={activeConv?.name} onClose={() => setSearchOpen(false)} onOpenResult={openSearchResult} />}
      {unreadNote && <NotePopup note={unreadNote} onDismiss={() => dismissNote(unreadNote.id)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
