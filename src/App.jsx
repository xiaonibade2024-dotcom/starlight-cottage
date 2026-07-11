import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { sendChatStream, sendChatFollowUp } from './lib/api'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import Settings from './components/Settings'
import SearchPanel from './components/SearchPanel'
import NotePopup from './components/NotePopup'

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('general')
  const [isStreaming, setIsStreaming] = useState(false)
  const [mood, setMood] = useState('warm')
  const [toast, setToast] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('anthropic/claude-sonnet-4.5')
  const [maxContextMessages, setMaxContextMessages] = useState(50)
  const [memories, setMemories] = useState([])
  const [unreadNote, setUnreadNote] = useState(null)
  const [cacheStats, setCacheStats] = useState({ hits: 0, tokens_saved: 0, last_cached: 0, last_prompt: 0, last_completion: 0 })
  const [stats, setStats] = useState({ totalMessages: 0, totalConversations: 0, firstChatDate: null })
  const [variantIndexes, setVariantIndexes] = useState({})
  const [scrollToMsgId, setScrollToMsgId] = useState(null)
  const toastTimeoutRef = useRef(null)
  const recentSavesRef = useRef(new Set())
  const abortControllerRef = useRef(null)

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
    loadStats()
  }, [user])

  const loadConversations = async () => {
    const { data, error } = await supabase.from('conversations').select('*').order('updated_at', { ascending: false })
    if (!error && data) setConversations(data)
  }

  const loadMessages = async (convId) => {
    const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true })
    if (!error && data) {
      setMessages(data)
      const indexes = {}
      data.forEach(m => {
        if (m.variants && m.variants.length > 0) {
          const currentIndex = m.variants.findIndex(v => v.content === m.content)
          indexes[m.id] = currentIndex >= 0 ? currentIndex : m.variants.length - 1
        }
      })
      setVariantIndexes(indexes)
    }
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
    }
  }

  const saveSettings = async (newSettings) => {
    const settings = {
      user_id: user.id,
      system_prompt: newSettings.systemPrompt ?? systemPrompt,
      model: newSettings.model ?? model,
      max_context_messages: newSettings.maxContextMessages ?? maxContextMessages
    }
    const { data: existing } = await supabase.from('user_settings').select('id').single()
    if (existing) {
      await supabase.from('user_settings').update(settings).eq('id', existing.id)
    } else {
      await supabase.from('user_settings').insert(settings)
    }
    if (newSettings.systemPrompt !== undefined) setSystemPrompt(newSettings.systemPrompt)
    if (newSettings.model !== undefined) setModel(newSettings.model)
    if (newSettings.maxContextMessages !== undefined) setMaxContextMessages(newSettings.maxContextMessages)
    showToast('设置已保存')
  }

  const saveApiKey = (key) => {
    setApiKey(key)
    localStorage.setItem('starlight_api_key', key)
    showToast('API Key 已保存到本地')
  }

  const loadUnreadNote = async () => {
    const { data } = await supabase.from('notes').select('*').eq('is_read', false).order('created_at', { ascending: false }).limit(1).single()
    if (data) setUnreadNote(data)
  }

  const dismissNote = async (noteId) => {
    await supabase.from('notes').update({ is_read: true }).eq('id', noteId)
    setUnreadNote(null)
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
    await loadMessages(convId)
    setSidebarOpen(false)
    const conv = conversations.find(c => c.id === convId)
    if (conv?.mood) setMood(conv.mood)
  }

  const createConversation = async (name = '新对话') => {
    const { data, error } = await supabase.from('conversations').insert({ user_id: user.id, name }).select().single()
    if (!error && data) {
      setConversations(prev => [data, ...prev])
      setActiveConvId(data.id)
      setMessages([])
      setMood('warm')
      setSidebarOpen(false)
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
    if (activeConvId === convId) { setActiveConvId(null); setMessages([]) }
    showToast('对话已删除')
    loadStats()
  }

  // ==========================================
  // 发送消息
  // ==========================================
  const sendMessage = async (content) => {
    if (!content.trim() || isStreaming) return
    if (!apiKey) { showToast('请先在设置中填写 API Key'); setSettingsOpen(true); return }

    let convId = activeConvId
    if (!convId) {
      const conv = await createConversation(content.slice(0, 20) + (content.length > 20 ? '...' : ''))
      if (!conv) return
      convId = conv.id
    }

    const { data: savedUserMsg } = await supabase.from('messages').insert({ conversation_id: convId, role: 'user', content: content.trim() }).select().single()
    if (!savedUserMsg) return
    setMessages(prev => [...prev, savedUserMsg])
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
    await streamAIResponse(convId, [...messages, savedUserMsg])
  }

  // ==========================================
  // 流式 AI 回复
  // ==========================================
  const streamAIResponse = async (convId, allMessages, existingMsgId = null) => {
    setIsStreaming(true)
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    let streamContent = ''
    const tempId = existingMsgId || ('streaming-' + Date.now())

    if (!existingMsgId) {
      setMessages(prev => [...prev, { id: tempId, conversation_id: convId, role: 'assistant', content: '', created_at: new Date().toISOString() }])
    } else {
      setMessages(prev => prev.map(m => m.id === existingMsgId ? { ...m, content: '' } : m))
    }

    const recentMessages = allMessages.slice(-maxContextMessages).map(m => ({ role: m.role, content: m.content }))

    try {
      await sendChatStream({
        apiKey, model, systemPrompt, memories, conversationHistory: recentMessages, enableTools: true, signal: abortController.signal,
        onToken: (token) => {
          streamContent += token
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: streamContent } : m))
        },
        onToolCall: async () => {},
        onUsage: (usage) => {
          const cachedTokens = usage.cached_tokens || usage.cache_read_input_tokens || 0
          setCacheStats(prev => ({
            hits: (cachedTokens > 0) ? prev.hits + 1 : prev.hits,
            tokens_saved: prev.tokens_saved + cachedTokens,
            last_cached: cachedTokens,
            last_prompt: usage.prompt_tokens || 0,
            last_completion: usage.completion_tokens || 0
          }))
        },
        onError: (error) => {
          showToast('发送失败: ' + error.message)
          if (!existingMsgId) setMessages(prev => prev.filter(m => m.id !== tempId))
        },
        onDone: async (finalContent, toolCalls) => {
          if (toolCalls.length > 0) {
            for (const tc of toolCalls) {
              if (tc?.function?.name) {
                try { const args = JSON.parse(tc.function.arguments); await handleToolCall(tc.function.name, args, convId) } catch (e) { console.error('工具调用处理失败:', e) }
              }
            }
          }

          if (finalContent) {
            if (existingMsgId) {
              const msg = allMessages.find(m => m.id === existingMsgId) || messages.find(m => m.id === existingMsgId)
              let variants = msg?.variants || []
              if (variants.length === 0 && msg) variants = [{ content: msg.content, created_at: msg.created_at }]
              variants.push({ content: finalContent, created_at: new Date().toISOString() })
              await supabase.from('messages').update({ content: finalContent, variants }).eq('id', existingMsgId)
              setMessages(prev => prev.map(m => m.id === existingMsgId ? { ...m, content: finalContent, variants } : m))
              setVariantIndexes(prev => ({ ...prev, [existingMsgId]: variants.length - 1 }))
            } else {
              const { data: savedMsg } = await supabase.from('messages').insert({ conversation_id: convId, role: 'assistant', content: finalContent }).select().single()
              if (savedMsg) setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m))
            }
          } else if (toolCalls.length > 0) {
            const assistantToolMsg = { role: 'assistant', content: null, tool_calls: toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments } })) }
            const toolResultMsgs = toolCalls.filter(tc => tc?.function?.name).map(tc => ({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ success: true }) }))
            try {
              let followUpStream = ''
              const { content: followUpContent, usage: followUpUsage } = await sendChatFollowUp({
                apiKey, model, systemPrompt, memories, conversationHistory: recentMessages, assistantToolMsg, toolResultMsgs, signal: abortController.signal,
                onToken: (token) => {
                  followUpStream += token
                  setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: followUpStream } : m))
                }
              })
              if (followUpUsage) {
                const followUpCached = followUpUsage.prompt_tokens_details?.cached_tokens || followUpUsage.cached_tokens || 0
                setCacheStats(prev => ({
                  hits: followUpCached > 0 ? prev.hits + 1 : prev.hits,
                  tokens_saved: prev.tokens_saved + followUpCached,
                  last_cached: followUpCached,
                  last_prompt: followUpUsage.prompt_tokens || 0,
                  last_completion: followUpUsage.completion_tokens || 0
                }))
              }
              if (followUpContent) {
                if (existingMsgId) {
                  const msg = allMessages.find(m => m.id === existingMsgId) || messages.find(m => m.id === existingMsgId)
                  let variants = msg?.variants || []
                  if (variants.length === 0 && msg) variants = [{ content: msg.content, created_at: msg.created_at }]
                  variants.push({ content: followUpContent, created_at: new Date().toISOString() })
                  await supabase.from('messages').update({ content: followUpContent, variants }).eq('id', existingMsgId)
                  setMessages(prev => prev.map(m => m.id === existingMsgId ? { ...m, content: followUpContent, variants } : m))
                  setVariantIndexes(prev => ({ ...prev, [existingMsgId]: variants.length - 1 }))
                } else {
                  setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: followUpContent } : m))
                  const { data: savedMsg } = await supabase.from('messages').insert({ conversation_id: convId, role: 'assistant', content: followUpContent }).select().single()
                  if (savedMsg) setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m))
                }
              } else { if (!existingMsgId) setMessages(prev => prev.filter(m => m.id !== tempId)) }
            } catch (e) { console.error('获取后续回复失败:', e); if (!existingMsgId) setMessages(prev => prev.filter(m => m.id !== tempId)); if (e.name !== 'AbortError') showToast('获取回复失败: ' + e.message) }
          } else { if (!existingMsgId) setMessages(prev => prev.filter(m => m.id !== tempId)) }

          setIsStreaming(false)
          abortControllerRef.current = null
          loadStats()
          loadConversations()
        }
      })
    } catch (error) {
      setIsStreaming(false)
      abortControllerRef.current = null
      if (!existingMsgId) setMessages(prev => prev.filter(m => m.id !== tempId))
      showToast('发送失败: ' + error.message)
    }
  }

  // ==========================================
  // 停止生成
  // ==========================================
  const stopStreaming = () => {
    abortControllerRef.current?.abort()
  }

  // ==========================================
  // 打开搜索结果
  // ==========================================
  const openSearchResult = async (convId, msgId) => {
    setSearchOpen(false)
    if (convId !== activeConvId) {
      await selectConversation(convId)
    }
    if (msgId) setScrollToMsgId(msgId)
  }

  // ==========================================
  // 重新生成 AI 回复
  // ==========================================
  const regenerateResponse = async (msgId) => {
    if (isStreaming || !apiKey) return
    const msgIndex = messages.findIndex(m => m.id === msgId)
    if (msgIndex < 0) return
    const historyMessages = messages.slice(0, msgIndex)
    const convId = messages[msgIndex].conversation_id
    await streamAIResponse(convId, historyMessages, msgId)
  }

  // ==========================================
  // 切换版本
  // ==========================================
  const switchVariant = async (msgId, newIndex) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg || !msg.variants || msg.variants.length === 0) return
    const variant = msg.variants[newIndex]
    if (!variant) return
    await supabase.from('messages').update({ content: variant.content }).eq('id', msgId)
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: variant.content } : m))
    setVariantIndexes(prev => ({ ...prev, [msgId]: newIndex }))
  }

  // ==========================================
  // 编辑消息（仅保存）
  // ==========================================
  const editMessage = async (msgId, newContent) => {
    if (!newContent.trim()) return
    await supabase.from('messages').update({ content: newContent.trim() }).eq('id', msgId)
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent.trim() } : m))
    showToast('消息已保存')
  }

  // ==========================================
  // 编辑并重新发送
  // ==========================================
  const editAndResend = async (msgId, newContent) => {
    if (!newContent.trim() || isStreaming || !apiKey) return

    // 保存编辑
    await supabase.from('messages').update({ content: newContent.trim() }).eq('id', msgId)
    const updatedMessages = messages.map(m => m.id === msgId ? { ...m, content: newContent.trim() } : m)
    setMessages(updatedMessages)

    const msgIndex = updatedMessages.findIndex(m => m.id === msgId)
    if (msgIndex < 0) return
    const convId = updatedMessages[msgIndex].conversation_id

    // 找到这条消息之后的 AI 回复
    const nextAssistantIndex = updatedMessages.findIndex((m, i) => i > msgIndex && m.role === 'assistant')

    if (nextAssistantIndex >= 0) {
      // 重新生成已有的 AI 回复
      const historyUpToUser = updatedMessages.slice(0, msgIndex + 1)
      await streamAIResponse(convId, historyUpToUser, updatedMessages[nextAssistantIndex].id)
    } else {
      // 没有 AI 回复，创建新的
      const historyUpToUser = updatedMessages.slice(0, msgIndex + 1)
      await streamAIResponse(convId, historyUpToUser)
    }
  }

  // ==========================================
  // 处理工具调用
  // ==========================================
  const handleToolCall = async (name, args, convId) => {
    switch (name) {
     case 'save_memory': {
        const key = args.content.trim().toLowerCase()
        const isDuplicate = memories.some(m => m.content.trim().toLowerCase() === key) || recentSavesRef.current.has(key)
        if (isDuplicate) {
          showToast('💭 这件事已经记住了')
          break
        }
        recentSavesRef.current.add(key)
        setTimeout(() => recentSavesRef.current.delete(key), 10000)
        const { data } = await supabase.from('memories').insert({ user_id: user.id, category: 'auto', content: args.content, tags: args.tags || [] }).select().single()
        if (data) { setMemories(prev => [...prev, data]); showToast('💭 记住了一件事') }
        break
      }
      case 'leave_note': {
        await supabase.from('notes').insert({ user_id: user.id, conversation_id: convId, content: args.content })
        showToast('📝 留了一张小纸条')
        break
      }
    }
  }

  const toggleFavorite = async (msgId) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const newFav = !msg.is_favorited
    await supabase.from('messages').update({ is_favorited: newFav }).eq('id', msgId)
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_favorited: newFav } : m))
    showToast(newFav ? '已收藏到回忆匣子 ✨' : '已取消收藏')
  }

  const deleteMemory = async (memId) => {
    await supabase.from('memories').delete().eq('id', memId)
    setMemories(prev => prev.filter(m => m.id !== memId))
    showToast('记忆已删除')
  }

  const addCoreMemory = async (content) => {
    const { data } = await supabase.from('memories').insert({ user_id: user.id, category: 'core', content, tags: ['核心'] }).select().single()
    if (data) { setMemories(prev => [...prev, data]); showToast('核心记忆已添加') }
  }

  const exportConversation = async (convId) => {
    const conv = conversations.find(c => c.id === convId)
    if (!conv) return
    const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true })
    const exportData = { conversation: conv, messages: msgs || [], exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${conv.name}_${new Date().toLocaleDateString()}.json`; a.click()
    URL.revokeObjectURL(url)
    showToast('对话已导出')
  }

  const exportAllData = async () => {
    const { data: allConvs } = await supabase.from('conversations').select('*')
    const { data: allMsgs } = await supabase.from('messages').select('*')
    const { data: allMems } = await supabase.from('memories').select('*')
    const { data: allNotes } = await supabase.from('notes').select('*')
    const exportData = { conversations: allConvs || [], messages: allMsgs || [], memories: allMems || [], notes: allNotes || [], exportedAt: new Date().toISOString() }
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

  return (
    <div className="app-container">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <Sidebar conversations={conversations} activeConvId={activeConvId} isOpen={sidebarOpen} onSelect={selectConversation} onCreate={createConversation} onRename={renameConversation} onDelete={deleteConversation} onExport={exportConversation} onExportAll={exportAllData} onOpenSettings={() => { setSettingsOpen(true); setSettingsTab('general') }} />
      <Chat
        conversation={activeConv} messages={messages} isStreaming={isStreaming} cacheStats={cacheStats} variantIndexes={variantIndexes}
        scrollToMsgId={scrollToMsgId} onScrollDone={() => setScrollToMsgId(null)}
        onSend={sendMessage} onStop={stopStreaming} onToggleFavorite={toggleFavorite} onRegenerate={regenerateResponse} onEditMessage={editMessage} onEditAndResend={editAndResend} onSwitchVariant={switchVariant}
        onMenuClick={() => setSidebarOpen(true)} onSettingsClick={() => { setSettingsOpen(true); setSettingsTab('general') }} onMemoryClick={() => { setSettingsOpen(true); setSettingsTab('memory') }} onSearchClick={() => setSearchOpen(true)}
      />
      {searchOpen && <SearchPanel activeConvId={activeConvId} activeConvName={activeConv?.name} onClose={() => setSearchOpen(false)} onOpenResult={openSearchResult} />}
      {settingsOpen && <Settings tab={settingsTab} onTabChange={setSettingsTab} apiKey={apiKey} systemPrompt={systemPrompt} model={model} maxContextMessages={maxContextMessages} memories={memories} stats={stats} onSaveApiKey={saveApiKey} onSaveSettings={saveSettings} onAddCoreMemory={addCoreMemory} onDeleteMemory={deleteMemory} onClose={() => setSettingsOpen(false)} />}
      {unreadNote && <NotePopup note={unreadNote} onDismiss={() => dismissNote(unreadNote.id)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
