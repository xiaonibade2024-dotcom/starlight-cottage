import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'

// ==========================================
// 钢笔画线条图标（内联 SVG，无任何依赖）
// ==========================================
const IC = {
  menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20.2 20.2L16 16" /></>,
  spark: <path d="M12 4c.9 3.6 2.4 5.1 6 6-3.6.9-5.1 2.4-6 6-.9-3.6-2.4-5.1-6-6 3.6-.9 5.1-2.4 6-6z" />,
  sliders: <><path d="M4 7h3.5" /><circle cx="9.5" cy="7" r="2" /><path d="M11.5 7H20" /><path d="M4 12h8.5" /><circle cx="14.5" cy="12" r="2" /><path d="M16.5 12H20" /><path d="M4 17h1.5" /><circle cx="7.5" cy="17" r="2" /><path d="M9.5 17H20" /></>,
  pencil: <><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3" /><path d="M13.5 6.5l3 3" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-15.5-2" /><path d="M4.5 5v4h4" /><path d="M4 13a8 8 0 0 0 15.5 2" /><path d="M19.5 19v-4h-4" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  trash: <><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6.5 7l1 12.2a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12.2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  chevL: <path d="M14.5 6L8.5 12l6 6" />,
  chevR: <path d="M9.5 6l6 6-6 6" />,
  chevU: <path d="M6 14.5l6-6 6 6" />,
  chevD: <path d="M6 9.5l6 6 6-6" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>
}

function Icon({ name, size = 17, sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      {IC[name]}
    </svg>
  )
}

// 压缩图片
function resizeImage(file, maxWidth = 1600) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// 解析消息内容
function parseContent(content) {
  if (!content) return { text: '', images: [] }
  try {
    const parsed = JSON.parse(content)
    if (parsed.images) return { text: parsed.text || '', images: parsed.images }
  } catch (e) {}
  return { text: content, images: [] }
}

// 时间格式化（移到组件外部，避免每次渲染重复创建）
function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return '今天 ' + time
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + time
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + time
}

// Markdown 渲染（移到组件外部）
function renderTextContent(text) {
  if (!text) return null
  return (
    <div className="md-content">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeHighlight]}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

// 消息内容渲染（移到组件外部）
function renderMessageContent(content) {
  const { text, images } = parseContent(content)
  return (
    <>
      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: text ? '8px' : '0' }}>
          {images.map((img, i) => (
            <img key={i} src={img} alt="" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' }} />
          ))}
        </div>
      )}
      {text && renderTextContent(text)}
    </>
  )
}

// ==========================================
// 单条消息组件（React.memo 包裹，防止不必要的重渲染）
// ==========================================
const MessageItem = React.memo(function MessageItem({
  msg, isEditing, editContent, onEditContentChange,
  isActive, isLastAssistant, variantIndex, isStreaming,
  branchIndex, branchTotal, onSwitchBranch,
  onMessageClick, onStartEdit, onSaveEdit, onSaveAndResend, onCancelEdit,
  onRegenerate, onCopyMessage, onToggleFavorite, onSwitchVariant, onDeleteMessage
}) {
  const editRef = useRef(null)

  // 编辑框自动聚焦和调整高度
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus()
      editRef.current.style.height = 'auto'
      editRef.current.style.height = editRef.current.scrollHeight + 'px'
    }
  }, [isEditing])

  const variants = msg.variants
  const hasVariants = variants && variants.length > 1

  return (
    <div id={'msg-' + msg.id} className={`message ${msg.role}`}>
      <div className="message-bubble" onClick={(e) => onMessageClick(msg.id, e)} style={{ cursor: isEditing ? 'default' : 'pointer' }}>
        {isEditing ? (
          <div style={{ minWidth: '280px' }}>
            <textarea ref={editRef} value={editContent} onChange={e => onEditContentChange(e.target.value)}
              style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={onCancelEdit} style={{ padding: '4px 14px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
              <button onClick={onSaveEdit} style={{ padding: '4px 14px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>保存</button>
              {msg.role === 'user' && (
                <button onClick={onSaveAndResend} style={{ padding: '4px 14px', fontSize: '13px', border: '1px solid var(--wash-border)', borderRadius: '16px', background: 'var(--wash-bg)', color: 'var(--accent)', cursor: 'pointer' }}>保存并发送</button>
              )}
            </div>
          </div>
        ) : (
          <>
            {renderMessageContent(msg.content)}
            {msg.role === 'assistant' && msg.id?.startsWith('streaming-') && isStreaming && !msg.content && (
              <div className="typing-indicator"><span /><span /><span /></div>
            )}
          </>
        )}
      </div>

      <div className="message-meta">
        <span className="message-time">{formatTime(msg.created_at)}</span>
        {branchTotal > 1 && !isEditing && !isStreaming && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
            <button className="msg-action" style={{ padding: '3px 4px' }} onClick={(e) => { e.stopPropagation(); if (branchIndex > 0) onSwitchBranch(msg.id, branchIndex - 1) }} disabled={branchIndex <= 0}><Icon name="chevL" size={13} /></button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'center' }}>{branchIndex + 1}/{branchTotal}</span>
            <button className="msg-action" style={{ padding: '3px 4px' }} onClick={(e) => { e.stopPropagation(); if (branchIndex < branchTotal - 1) onSwitchBranch(msg.id, branchIndex + 1) }} disabled={branchIndex >= branchTotal - 1}><Icon name="chevR" size={13} /></button>
          </span>
        )}
        {hasVariants && !isEditing && !(branchTotal > 1) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
            <button className="msg-action" style={{ padding: '3px 4px' }} onClick={(e) => { e.stopPropagation(); if (variantIndex > 0) onSwitchVariant(msg.id, variantIndex - 1) }} disabled={variantIndex <= 0}><Icon name="chevL" size={13} /></button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'center' }}>{variantIndex + 1}/{variants.length}</span>
            <button className="msg-action" style={{ padding: '3px 4px' }} onClick={(e) => { e.stopPropagation(); if (variantIndex < variants.length - 1) onSwitchVariant(msg.id, variantIndex + 1) }} disabled={variantIndex >= variants.length - 1}><Icon name="chevR" size={13} /></button>
          </span>
        )}
        {isActive && !msg.id?.startsWith('streaming-') && !isEditing && !isStreaming && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
            <button className="msg-action" onClick={(e) => { e.stopPropagation(); onStartEdit(msg) }} title="编辑"><Icon name="pencil" size={15} /></button>
            {msg.role === 'assistant' && isLastAssistant && (
              <button className="msg-action" onClick={(e) => { e.stopPropagation(); onRegenerate(msg.id) }} title="重新生成"><Icon name="refresh" size={15} /></button>
            )}
            <button className="msg-action" onClick={(e) => { e.stopPropagation(); onCopyMessage(msg.content) }} title="复制"><Icon name="copy" size={15} /></button>
            <button className="msg-action danger" onClick={(e) => { e.stopPropagation(); if (confirm('确定删除这条消息吗？删除后他也看不到这条了。')) onDeleteMessage(msg.id) }} title="删除"><Icon name="trash" size={15} /></button>
            {msg.role === 'assistant' && (
              <button className={msg.is_favorited ? 'msg-action fav-on' : 'msg-action'} style={{ fontSize: '14px' }} onClick={(e) => { e.stopPropagation(); onToggleFavorite(msg.id) }} title={msg.is_favorited ? '取消收藏' : '收藏'}>
                {msg.is_favorited ? '♥' : '♡'}
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  // 自定义比较函数：只比较影响渲染的数据 props，跳过回调函数的比较
  // 这样即使 Chat 组件重渲染导致回调函数引用变化，消息也不会跟着重渲染
  return (
    prev.msg === next.msg &&
    prev.isEditing === next.isEditing &&
    prev.editContent === next.editContent &&
    prev.isActive === next.isActive &&
    prev.isLastAssistant === next.isLastAssistant &&
    prev.variantIndex === next.variantIndex &&
    prev.isStreaming === next.isStreaming &&
    prev.branchIndex === next.branchIndex &&
    prev.branchTotal === next.branchTotal
  )
})

// ==========================================
// 主聊天组件
// ==========================================
export default function Chat({
  conversation, messages, isStreaming, cacheStats, variantIndexes, branchInfo, onSwitchBranch, scrollToMsgId, onScrollDone, currentModel, onChangeModel,
  daysTogether = 0, hidden = false,
  onSend, onStop, onToggleFavorite, onRegenerate, onEditMessage, onEditAndResend, onSwitchVariant, onDeleteMessage,
  onMenuClick, onSearchClick
}) {
  const [input, setInput] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [activeMessageId, setActiveMessageId] = useState(null)
  const [pendingImages, setPendingImages] = useState([])
  const messagesEndRef = useRef(null)
  const messagesAreaRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const isNearBottomRef = useRef(true)
  const [modelPanelOpen, setModelPanelOpen] = useState(false)
  const [modelList, setModelList] = useState(null)

  const FALLBACK_MODELS = ['anthropic/claude-sonnet-4.5', 'anthropic/claude-opus-4.1', 'anthropic/claude-3.7-sonnet', 'anthropic/claude-3.5-haiku']

  // 预计算最后一条 AI 消息的 ID（用 useMemo 缓存，只在 messages 变化时重新计算）
  const lastAssistantId = useMemo(() => {
    const assistants = messages.filter(m => m.role === 'assistant' && !m.id?.startsWith('streaming-'))
    return assistants.length > 0 ? assistants[assistants.length - 1].id : null
  }, [messages])

  // 第一次打开面板时才去拉取 Claude 系模型列表
  const openModelPanel = () => {
    setModelPanelOpen(v => !v)
    if (modelList === null) {
      fetch('https://openrouter.ai/api/v1/models')
        .then(r => r.json())
        .then(data => {
          const ids = (data?.data || []).map(m => m.id).filter(id => id && id.startsWith('anthropic/')).sort()
          setModelList(ids.length > 0 ? ids : FALLBACK_MODELS)
        })
        .catch(() => setModelList(FALLBACK_MODELS))
    }
  }

  const pickModel = (id) => {
    onChangeModel?.(id)
    setModelPanelOpen(false)
  }

  // 智能滚动：只有当你本来就在底部附近时，新内容才会带着页面往下滚
  // 如果你翻上去看历史记录，就不打扰你
  useEffect(() => {
    if (scrollToMsgId) return
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // 切换对话时，回到跟随模式并落到底部
  useEffect(() => {
    if (scrollToMsgId) return
    isNearBottomRef.current = true
    messagesEndRef.current?.scrollIntoView()
  }, [conversation?.id])

  // 搜索定位：滚动到目标消息并闪一下淡紫光
  useEffect(() => {
    if (!scrollToMsgId) return
    const el = document.getElementById('msg-' + scrollToMsgId)
    if (el) {
      isNearBottomRef.current = false
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const bubble = el.querySelector('.message-bubble')
      if (bubble) {
        bubble.classList.add('flash')
        setTimeout(() => bubble.classList.remove('flash'), 1700)
      }
    }
    onScrollDone?.()
  }, [scrollToMsgId, messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  const handleScroll = () => {
    if (!messagesAreaRef.current) return
    const distance = messagesAreaRef.current.scrollHeight - messagesAreaRef.current.scrollTop - messagesAreaRef.current.clientHeight
    setShowScrollBtn(distance > 200)
    isNearBottomRef.current = distance < 100
  }

  const handleSend = () => {
    if ((!input.trim() && pendingImages.length === 0) || isStreaming) return

    if (pendingImages.length > 0) {
      const content = JSON.stringify({ text: input.trim(), images: pendingImages })
      onSend(content)
      setPendingImages([])
    } else {
      onSend(input.trim())
    }
    setInput('')
    isNearBottomRef.current = true
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (textareaRef.current) textareaRef.current.style.height = '44px'
  }

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const base64 = await resizeImage(file)
      setPendingImages(prev => [...prev, base64])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingImage = (index) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index))
  }

  const scrollToTop = () => { messagesAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }
  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  const handleMessageClick = useCallback((msgId, e) => {
    e.stopPropagation()
    setActiveMessageId(prev => prev === msgId ? null : msgId)
  }, [])
  const handleAreaClick = () => { if (!editingId) setActiveMessageId(null) }

  const startEdit = useCallback((msg) => {
    const { text } = parseContent(msg.content)
    setEditingId(msg.id)
    setEditContent(text)
    setActiveMessageId(null)
  }, [])
  const saveEdit = () => { if (editContent.trim() && editingId) { onEditMessage(editingId, editContent); setEditingId(null); setEditContent('') } }
  const saveAndResend = () => { if (editContent.trim() && editingId) { onEditAndResend(editingId, editContent); setEditingId(null); setEditContent('') } }
  const cancelEdit = () => { setEditingId(null); setEditContent('') }

  const copyMessage = useCallback((content) => {
    const { text } = parseContent(content)
    navigator.clipboard.writeText(text).then(() => {
      const el = document.createElement('div')
      el.textContent = '已复制'
      el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 20px;border-radius:8px;font-size:13px;z-index:9999;pointer-events:none;'
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 1200)
    })
  }, [])

  const infoBarVisible = cacheStats.last_prompt > 0 || cacheStats.last_cached > 0

  return (
    <div className="main-area" style={hidden ? { display: 'none' } : undefined}>
      <div className="chat-header">
        <div className="chat-header-left">
          <button className="menu-btn" onClick={onMenuClick}><Icon name="menu" size={20} sw={1.7} /></button>
          <div className="chat-header-title-block">
            <span className="chat-header-title">{conversation?.name || '星月小屋'}</span>
            {/* 副行：相识第 X 天；状态词位置预留但暂不填字（预留抽屉） */}
            {daysTogether > 0 && <span className="chat-header-sub">相识第 {daysTogether} 天</span>}
          </div>
        </div>
        <div className="chat-header-right">
          <button className="header-btn" title="搜索" onClick={onSearchClick}><Icon name="search" /></button>
          <div style={{ position: 'relative' }}>
            <button className="model-badge" onClick={openModelPanel} title="切换当前对话的模型">{(currentModel || '').replace(/^anthropic\//, '') || '选择模型'} ▾</button>
            {modelPanelOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setModelPanelOpen(false)} />
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 91, width: '270px', maxHeight: '320px', overflowY: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px' }}>
                  {modelList === null && (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>加载中…</div>
                  )}
                  {(modelList || []).map(id => {
                    const active = id === currentModel
                    return (
                      <div key={id}
                        onClick={() => pickModel(id)}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        style={{ padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ wordBreak: 'break-all' }}>{id.replace(/^anthropic\//, '')}</span>
                        {active && <span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>}
                      </div>
                    )
                  })}
                  {modelList !== null && (
                    <>
                      <div style={{ height: '1px', background: 'var(--border)', margin: '6px 4px' }} />
                      <div
                        onClick={() => pickModel(null)}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        style={{ padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>跟随全局默认（小屋里的模型）</span>
                        {!conversation?.model && <span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="messages-area" ref={messagesAreaRef} onScroll={handleScroll} onClick={handleAreaClick}>
        {messages.length === 0 && !conversation && (
          <div className="empty-state">
            <div className="empty-state-icon">🌙</div>
            <div className="empty-state-text">欢迎来到星月小屋<br />在这里，每一句对话都会被温柔地记住</div>
          </div>
        )}
        {messages.length === 0 && conversation && (
          <div className="empty-state"><div className="empty-state-text" style={{ color: 'var(--text-muted)' }}>新的对话，新的开始</div></div>
        )}

        {messages.map(msg => (
          <MessageItem
            key={msg.id}
            msg={msg}
            isEditing={editingId === msg.id}
            editContent={editingId === msg.id ? editContent : ''}
            onEditContentChange={setEditContent}
            isActive={activeMessageId === msg.id}
            isLastAssistant={msg.id === lastAssistantId}
            variantIndex={variantIndexes[msg.id] ?? 0}
            isStreaming={isStreaming}
            branchIndex={branchInfo?.[msg.id]?.index ?? 0}
            branchTotal={branchInfo?.[msg.id]?.total ?? 0}
            onSwitchBranch={onSwitchBranch}
            onMessageClick={handleMessageClick}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onSaveAndResend={saveAndResend}
            onCancelEdit={cancelEdit}
            onRegenerate={onRegenerate}
            onCopyMessage={copyMessage}
            onToggleFavorite={onToggleFavorite}
            onSwitchVariant={onSwitchVariant}
            onDeleteMessage={onDeleteMessage}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {(cacheStats.last_prompt > 0 || cacheStats.last_cached > 0) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '4px 12px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', flexWrap: 'wrap' }}>
          {cacheStats.last_prompt > 0 && <span>提示 {cacheStats.last_prompt}</span>}
          {cacheStats.last_completion > 0 && <span>回复 {cacheStats.last_completion}</span>}
          {(cacheStats.last_prompt > 0 || cacheStats.last_completion > 0) && <span>共 {(cacheStats.last_prompt || 0) + (cacheStats.last_completion || 0)}</span>}
          {cacheStats.last_cached > 0 && <span style={{ color: 'var(--accent, #7c6ca8)' }}>✦ 缓存命中 {cacheStats.last_cached}</span>}
          {cacheStats.last_cache_write > 0 && <span style={{ color: 'var(--text-muted)' }}>✧ 缓存写入 {cacheStats.last_cache_write}</span>}
        </div>
      )}

      {messages.length > 5 && (
        <button onClick={scrollToTop} title="回到顶部" style={{ position: 'absolute', right: '16px', bottom: showScrollBtn ? (infoBarVisible ? '162px' : '136px') : (infoBarVisible ? '112px' : '86px'), width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', opacity: 0.8, transition: 'opacity 0.2s, bottom 0.2s', zIndex: 10 }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}><Icon name="chevU" size={16} /></button>
      )}
      {showScrollBtn && (
        <button onClick={scrollToBottom} title="回到最新" style={{ position: 'absolute', right: '16px', bottom: infoBarVisible ? '112px' : '86px', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--wash-border)', background: 'var(--wash-bg)', color: 'var(--accent)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'bottom 0.2s', zIndex: 10 }}><Icon name="chevD" size={16} /></button>
      )}

      {/* 图片预览 */}
      {pendingImages.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', overflowX: 'auto' }}>
          {pendingImages.map((img, i) => (
            <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
              <img src={img} alt="" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover' }} />
              <button onClick={() => removePendingImage(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* 输入区域（模型徽章已搬去顶栏；⊕/输入框/♥ 三件套 44px 等高对称不动） */}
      <div className="input-area">
        <div className="input-wrapper" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <input type="file" ref={fileInputRef} accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageSelect} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="添加图片"
          ><Icon name="plus" size={19} sw={1.5} /></button>
          <textarea ref={textareaRef} className="input-box" placeholder="" value={input} onChange={e => setInput(e.target.value)} rows={1} />
          <button className="send-btn" onClick={isStreaming ? onStop : handleSend} disabled={!isStreaming && !input.trim() && pendingImages.length === 0} title={isStreaming ? '停止生成' : '发送'}>{isStreaming ? '■' : '♥'}</button>
        </div>
      </div>
    </div>
  )
}
