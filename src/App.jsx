import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { sendChatStream, sendChat } from './lib/api'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import Chat from './components/Chat'
import Settings from './components/Settings'
import NotePopup from './components/NotePopup'

export default function App() {
  // ===== 认证状态 =====
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // ===== 对话状态 =====
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([])

  // ===== UI 状态 =====
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('general')
  const [isStreaming, setIsStreaming] = useState(false)
  const [mood, setMood] = useState('warm')
  const [toast, setToast] = useState(null)

  // ===== 设置 =====
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('anthropic/claude-sonnet-4.5')
  const [maxContextMessages, setMaxContextMessages] = useState(50)

  // ===== 记忆 =====
  const [memories, setMemories] = useState([])

  // ===== 留言条 =====
  const [unreadNote, setUnreadNote] = useState(null)

  // ===== 缓存统计 =====
  const [cacheStats, setCacheStats] = useState({ hits: 0, tokens_saved: 0, last_cached: 0 })

  // ===== 统计 =====
  const [stats, setStats] = useState({ totalMessages: 0, totalConversations: 0, firstChatDate: null })

  // ===== Refs =====
  const toastTimeoutRef = useRef(null)

  // ==========================================
  // Toast 提示
  // ==========================================
  const showToast = useCallback((msg) => {
    setToast(msg)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ==========================================
  // 认证相关
  // ==========================================
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

  // ==========================================
  // 初始化数据
  // ==========================================
  useEffect(() => {
    if (!user) return

    // 从 localStorage 加载 API Key
    const savedKey = localStorage.getItem('starlight_api_key')
    if (savedKey) setApiKey(savedKey)

    // 加载对话列表
    loadConversations()
    // 加载记忆
    loadMemories()
    // 加载用户设置
    loadSettings()
    // 加载未读留言
    loadUnreadNote()
    // 加载统计
    loadStats()
  }, [user])

  // ==========================================
  // 加载对话列表
  // ==========================================
  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!error && data) {
      setConversations(data)
    }
  }

  // ==========================================
  // 加载消息
  // ==========================================
  const loadMessages = async (convId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setMessages(data)
    }
  }

  // ==========================================
  // 加载记忆
  // ==========================================
  const loadMemories = async () => {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error && data) {
      setMemories(data)
    }
  }

  // ==========================================
  // 加载设置
  // ==========================================
  const loadSettings = async () => {
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .single()

    if (data) {
      setSystemPrompt(data.system_prompt || '')
      setModel(data.model || 'anthropic/claude-sonnet-4.5')
      setMaxContextMessages(data.max_context_messages || 50)
    }
  }

  // ==========================================
  // 保存设置
  // ==========================================
  const saveSettings = async (newSettings) => {
    const settings = {
      user_id: user.id,
      system_prompt: newSettings.systemPrompt ?? systemPrompt,
      model: newSettings.model ?? model,
      max_context_messages: newSettings.maxContextMessages ?? maxContextMessages
    }

    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .single()

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

  // ==========================================
  // 保存 API Key（仅本地）
  // ==========================================
  const saveApiKey = (key) => {
    setApiKey(key)
    localStorage.setItem('starlight_api_key', key)
    showToast('API Key 已保存到本地')
  }

  // ==========================================
  // 加载未读留言
  // ==========================================
  const loadUnreadNote = async () => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      setUnreadNote(data)
    }
  }

  // ==========================================
  // 标记留言已读
  // ==========================================
  const dismissNote = async (noteId) => {
    await supabase.from('notes').update({ is_read: true }).eq('id', noteId)
    setUnreadNote(null)
  }

  // ==========================================
  // 加载统计
  // ==========================================
  const loadStats = async () => {
    const { count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })

    const { count: convCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })

    const { data: firstConv } = await supabase
      .from('conversations')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    setStats({
      totalMessages: msgCount || 0,
      totalConversations: convCount || 0,
      firstChatDate: firstConv?.created_at || null
    })
  }

  // ==========================================
  // 切换对话
  // ==========================================
  const selectConversation = async (convId) => {
    setActiveConvId(convId)
    await loadMessages(convId)
    setSidebarOpen(false)

    // 获取对话的 mood
    const conv = conversations.find(c => c.id === convId)
    if (conv?.mood) setMood(conv.mood)
  }

  // ==========================================
  // 新建对话
  // ==========================================
  const createConversation = async (name = '新对话') => {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, name })
      .select()
      .single()

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

  // ==========================================
  // 重命名对话
  // ==========================================
  const renameConversation = async (convId, newName) => {
    await supabase.from('conversations').update({ name: newName }).eq('id', convId)
    setConversations(prev =>
      prev.map(c => c.id === convId ? { ...c, name: newName } : c)
    )
  }

  // ==========================================
  // 删除对话
  // ==========================================
  const deleteConversation = async (convId) => {
    await supabase.from('conversations').delete().eq('id', convId)
    setConversations(prev => prev.filter(c => c.id !== convId))
    if (activeConvId === convId) {
      setActiveConvId(null)
      setMessages([])
    }
    showToast('对话已删除')
    loadStats()
  }

  // ==========================================
  // 发送消息
  // ==========================================
  const sendMessage = async (content) => {
    if (!content.trim() || isStreaming) return
    if (!apiKey) {
      showToast('请先在设置中填写 API Key')
      setSettingsOpen(true)
      return
    }

    // 如果没有活跃对话，自动创建一个
    let convId = activeConvId
    if (!convId) {
      const conv = await createConversation(content.slice(0, 20) + (content.length > 20 ? '...' : ''))
      if (!conv) return
      convId = conv.id
    }

    // 保存用户消息
    const userMsg = {
      conversation_id: convId,
      role: 'user',
      content: content.trim()
    }
    const { data: savedUserMsg } = await supabase
      .from('messages')
      .insert(userMsg)
      .select()
      .single()

    if (!savedUserMsg) return

    setMessages(prev => [...prev, savedUserMsg])

    // 更新对话时间
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)

    // 开始流式请求
    setIsStreaming(true)
    let streamContent = ''
    const tempId = 'streaming-' + Date.now()

    // 添加临时的助手消息
    setMessages(prev => [...prev, {
      id: tempId,
      conversation_id: convId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    }])

    // 准备对话历史（限制长度）
    const recentMessages = [...messages, savedUserMsg]
      .slice(-maxContextMessages)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      await sendChatStream({
        apiKey,
        model,
        systemPrompt,
        memories,
        conversationHistory: recentMessages,
        enableTools: true,
        onToken: (token) => {
          streamContent += token
          setMessages(prev =>
            prev.map(m => m.id === tempId ? { ...m, content: streamContent } : m)
          )
        },
        onToolCall: async (name, args, toolId) => {
          await handleToolCall(name, args, convId)
        },
        onUsage: (usage) => {
          setCacheStats(prev => ({
            hits: (usage.cached_tokens > 0) ? prev.hits + 1 : prev.hits,
            tokens_saved: prev.tokens_saved + (usage.cached_tokens || 0),
            last_cached: usage.cached_tokens || 0,
            last_prompt: usage.prompt_tokens || 0,
            last_completion: usage.completion_tokens || 0
          }))
        },
        onError: (error) => {
          showToast('发送失败: ' + error.message)
          // 移除临时消息
          setMessages(prev => prev.filter(m => m.id !== tempId))
        },
        onDone: async (finalContent, toolCalls) => {
          // 先处理工具调用
          if (toolCalls.length > 0) {
            for (const tc of toolCalls) {
              if (tc?.function?.name) {
                try {
                  const args = JSON.parse(tc.function.arguments)
                  await handleToolCall(tc.function.name, args, convId)
                } catch (e) {
                  console.error('工具调用处理失败:', e)
                }
              }
            }
          }

          if (finalContent) {
            const { data: savedMsg } = await supabase
              .from('messages')
              .insert({
                conversation_id: convId,
                role: 'assistant',
                content: finalContent
              })
              .select()
              .single()

            if (savedMsg) {
              setMessages(prev =>
                prev.map(m => m.id === tempId ? savedMsg : m)
              )
            }
          } else if (toolCalls.length > 0) {
            // AI 只调用了工具没有文字，把工具结果发回让 AI 继续说话
            const assistantToolMsg = {
              role: 'assistant',
              content: null,
              tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments
                }
              }))
            }

            const toolResultMsgs = toolCalls
              .filter(tc => tc?.function?.name)
              .map(tc => ({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify({ success: true })
              }))

            const followUpMessages = []
            if (systemPrompt) {
              followUpMessages.push({ role: 'system', content: systemPrompt })
            }
            followUpMessages.push(...recentMessages)
            followUpMessages.push(assistantToolMsg)
            followUpMessages.push(...toolResultMsgs)

            try {
              const { content: followUpContent } = await sendChat({
                apiKey,
                model,
                messages: followUpMessages,
                maxTokens: 2000
              })

              if (followUpContent) {
                setMessages(prev =>
                  prev.map(m => m.id === tempId ? { ...m, content: followUpContent } : m)
                )
                const { data: savedMsg } = await supabase
                  .from('messages')
                  .insert({
                    conversation_id: convId,
                    role: 'assistant',
                    content: followUpContent
                  })
                  .select()
                  .single()

                if (savedMsg) {
                  setMessages(prev =>
                    prev.map(m => m.id === tempId ? savedMsg : m)
                  )
                }
              } else {
                setMessages(prev => prev.filter(m => m.id !== tempId))
              }
            } catch (e) {
              console.error('获取后续回复失败:', e)
              setMessages(prev => prev.filter(m => m.id !== tempId))
              showToast('获取回复失败: ' + e.message)
            }
          } else {
            setMessages(prev => prev.filter(m => m.id !== tempId))
          }

          setIsStreaming(false)
          loadStats()
          loadConversations()
        }
      })
    } catch (error) {
      setIsStreaming(false)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      showToast('发送失败: ' + error.message)
    }
  }

  // ==========================================
  // 处理工具调用
  // ==========================================
  const handleToolCall = async (name, args, convId) => {
    switch (name) {
      case 'save_memory': {
        const { data } = await supabase
          .from('memories')
          .insert({
            user_id: user.id,
            category: 'auto',
            content: args.content,
            tags: args.tags || []
          })
          .select()
          .single()

        if (data) {
          setMemories(prev => [...prev, data])
          showToast('💭 记住了一件事')
        }
        break
      }
      case 'leave_note': {
        await supabase.from('notes').insert({
          user_id: user.id,
          conversation_id: convId,
          content: args.content
        })
        showToast('📝 留了一张小纸条')
        break
      }
      case 'set_mood': {
        setMood(args.mood)
        if (convId) {
          await supabase.from('conversations').update({ mood: args.mood }).eq('id', convId)
        }
        break
      }
    }
  }

  // ==========================================
  // 收藏消息
  // ==========================================
  const toggleFavorite = async (msgId) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return

    const newFav = !msg.is_favorited
    await supabase.from('messages').update({ is_favorited: newFav }).eq('id', msgId)
    setMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, is_favorited: newFav } : m)
    )
    showToast(newFav ? '已收藏到回忆匣子 ✨' : '已取消收藏')
  }

  // ==========================================
  // 删除记忆
  // ==========================================
  const deleteMemory = async (memId) => {
    await supabase.from('memories').delete().eq('id', memId)
    setMemories(prev => prev.filter(m => m.id !== memId))
    showToast('记忆已删除')
  }

  // ==========================================
  // 添加核心记忆
  // ==========================================
  const addCoreMemory = async (content) => {
    const { data } = await supabase
      .from('memories')
      .insert({
        user_id: user.id,
        category: 'core',
        content,
        tags: ['核心']
      })
      .select()
      .single()

    if (data) {
      setMemories(prev => [...prev, data])
      showToast('核心记忆已添加')
    }
  }

  // ==========================================
  // 导出对话
  // ==========================================
  const exportConversation = async (convId) => {
    const conv = conversations.find(c => c.id === convId)
    if (!conv) return

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    const exportData = {
      conversation: conv,
      messages: msgs || [],
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conv.name}_${new Date().toLocaleDateString()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('对话已导出')
  }

  // ==========================================
  // 导出全部数据
  // ==========================================
  const exportAllData = async () => {
    const { data: allConvs } = await supabase.from('conversations').select('*')
    const { data: allMsgs } = await supabase.from('messages').select('*')
    const { data: allMems } = await supabase.from('memories').select('*')
    const { data: allNotes } = await supabase.from('notes').select('*')

    const exportData = {
      conversations: allConvs || [],
      messages: allMsgs || [],
      memories: allMems || [],
      notes: allNotes || [],
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `星月小屋_全部数据_${new Date().toLocaleDateString()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('全部数据已导出')
  }

  // ==========================================
  // 渲染
  // ==========================================
  if (authLoading) {
    return (
      <div className="auth-container">
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>加载中...</div>
      </div>
    )
  }

  if (!user) {
    return <Auth onAuth={() => {}} />
  }

  const activeConv = conversations.find(c => c.id === activeConvId)

  return (
    <div className="app-container" data-mood={mood}>
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 侧边栏 */}
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        isOpen={sidebarOpen}
        onSelect={selectConversation}
        onCreate={createConversation}
        onRename={renameConversation}
        onDelete={deleteConversation}
        onExport={exportConversation}
        onExportAll={exportAllData}
        onOpenSettings={() => { setSettingsOpen(true); setSettingsTab('general') }}
      />

      {/* 主聊天区域 */}
      <Chat
        conversation={activeConv}
        messages={messages}
        isStreaming={isStreaming}
        cacheStats={cacheStats}
        onSend={sendMessage}
        onToggleFavorite={toggleFavorite}
        onMenuClick={() => setSidebarOpen(true)}
        onSettingsClick={() => { setSettingsOpen(true); setSettingsTab('general') }}
        onMemoryClick={() => { setSettingsOpen(true); setSettingsTab('memory') }}
      />

      {/* 设置面板 */}
      {settingsOpen && (
        <Settings
          tab={settingsTab}
          onTabChange={setSettingsTab}
          apiKey={apiKey}
          systemPrompt={systemPrompt}
          model={model}
          maxContextMessages={maxContextMessages}
          memories={memories}
          stats={stats}
          onSaveApiKey={saveApiKey}
          onSaveSettings={saveSettings}
          onAddCoreMemory={addCoreMemory}
          onDeleteMemory={deleteMemory}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* 留言条弹窗 */}
      {unreadNote && (
        <NotePopup
          note={unreadNote}
          onDismiss={() => dismissNote(unreadNote.id)}
        />
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
