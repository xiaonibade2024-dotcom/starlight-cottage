import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'

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

// 按钮样式（移到组件外部，避免每次渲染重复创建对象）
const actionBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '4px 8px', borderRadius: '6px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }
const variantBtnStyle = { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', borderRadius: '4px' }
const favBtnActiveStyle = { ...actionBtnStyle, color: '#e74c3c' }

// ==========================================
// 单条消息组件（React.memo 包裹，防止不必要的重渲染）
// ==========================================
const MessageItem = React.memo(function MessageItem({
  msg, isEditing, editContent, onEditContentChange,
  isActive, isLastAssistant, variantIndex, isStreaming,
  onMessageClick, onStartEdit, onSaveEdit, onSaveAndResend, onCancelEdit,
  onRegenerate, onCopyMessage, onToggleFavorite, onSwitchVariant
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
              <button onClick={onCancelEdit} style={{ padding: '4px 14px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
              <button onClick={onSaveEdit} style={{ padding: '4px 14px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>保存</button>
              {msg.role === 'user' && (
                <button onClick={onSaveAndResend} style={{ padding: '4px 14px', fontSize: '13px', border: 'none', borderRadius: '8px', background: 'var(--accent, #7c6ca8)', color: 'white', cursor: 'pointer' }}>保存并发送</button>
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
        {hasVariants && !isEditing && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
            <button style={variantBtnStyle} onClick={(e) => { e.stopPropagation(); if (variantIndex > 0) onSwitchVariant(msg.id, variantIndex - 1) }} disabled={variantIndex <= 0}>◀</button>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'center' }}>{variantIndex + 1}/{variants.length}</span>
            <button style={variantBtnStyle} onClick={(e) => { e.stopPropagation(); if (variantIndex < variants.length - 1) onSwitchVariant(msg.id, variantIndex + 1) }} disabled={variantIndex >= variants.length - 1}>▶</button>
          </span>
        )}
        {isActive && !msg.id?.startsWith('streaming-') && !isEditing && !isStreaming && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
            <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); onStartEdit(msg) }} title="编辑">✏️</button>
            {msg.role === 'assistant' && isLastAssistant && (
              <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); onRegenerate(msg.id) }} title="重新生成">🔄</button>
            )}
            <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); onCopyMessage(msg.content) }} title="复制">📋</button>
            {msg.role === 'assistant' && (
              <button style={msg.is_favorited ? favBtnActiveStyle : actionBtnStyle} onClick={(e) => { e.stopPropagation(); onToggleFavorite(msg.id) }} title={msg.is_favorited ? '取消收藏' : '收藏'}>
                {msg.is_favorited ? '♥' : '♡'}
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  )
}, (prev, next) => {
  return (
    prev.msg === next.msg &&
    prev.isEditing === next.isEditing &&
    prev.editContent === next.editContent &&
    prev.isActive === next.isActive &&
    prev.isLastAssistant === next.isLastAssistant &&
    prev.variantIndex === next.variantIndex &&
    prev.isStreaming === next.isStreaming
  )
})

// ==========================================
// 主聊天组件
// ==========================================
export default function Chat({
  conversation, messages, isStreaming, cacheStats, variantIndexes, scrollToMsgId, onScrollDone, currentModel, onChangeModel,
  pureMode, onTogglePureMode,
  onSend, onStop, onToggleFavorite, onRegenerate, onEditMessage, onEditAndResend, onSwitchVariant,
  onMenuClick, onSettingsClick, onMemoryClick, onSearchClick
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

  const lastAssistantId = useMemo(() => {
    const assistants = messages.filter(m => m.role === 'assistant' && !m.id?.startsWith('streaming-'))
    return assistants.length > 0 ? assistants[assistants.length - 1].id : null
  }, [messages])

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

  useEffect(() => {
    if (scrollToMsgId) return
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (scrollToMsgId) return
    isNearBottomRef.current = true
    messagesEndRef.current?.scrollIntoView()
  }, [conversation?.id])

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
    <div className="main-area">
      <div className="chat-header">
        <div className="chat-header-left">
          <button className="menu-btn" onClick={onMenuClick}>☰</button>
          <span className="chat-header-title">{conversation?.name || '星月小屋'}</span>
        </div>
        <div className="chat-header-right">
          <button className="header-btn" title="搜索" onClick={onSearchClick}>🔍</button>
          <button className="header-btn" title="记忆" onClick={onMemoryClick}>💭</button>
          <button className="header-btn" title="设置" onClick={onSettingsClick}>⚙</button>
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
            onMessageClick={handleMessageClick}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onSaveAndResend={saveAndResend}
            onCancelEdit={cancelEdit}
            onRegenerate={onRegenerate}
            onCopyMessage={copyMessage}
            onToggleFavorite={onToggleFavorite}
            onSwitchVariant={onSwitchVariant}
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
        <button onClick={scrollToTop} title="回到顶部" style={{ position: 'absolute', right: '16px', bottom: showScrollBtn ? (infoBarVisible ? '200px' : '174px') : (infoBarVisible ? '150px' : '124px'), width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', opacity: 0.8, transition: 'opacity 0.2s, bottom 0.2s', zIndex: 10 }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}>↑</button>
      )}
      {showScrollBtn && (
        <button onClick={scrollToBottom} title="回到最新" style={{ position: 'absolute', right: '16px', bottom: infoBarVisible ? '150px' : '124px', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--accent, #7c6ca8)', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'bottom 0.2s', zIndex: 10 }}>↓</button>
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

      {/* 输入区域 */}
      <div className="input-area">
        {/* 工具条：纯净模式 + 模型徽章，靠右排列 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '8px', gap: '8px' }}>
          {conversation && (
            <button
              onClick={onTogglePureMode}
              title={pureMode ? '切换到完整模式（恢复记忆和纸条）' : '切换到纯净模式（关闭记忆和纸条）'}
              style={{ padding: '5px 12px', fontSize: '12px', border: '1px solid ' + (pureMode ? '#A8C4A0' : 'var(--border)'), borderRadius: '14px', background: pureMode ? 'rgba(168, 196, 160, 0.12)' : 'var(--bg-secondary)', color: pureMode ? '#A8C4A0' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.3s' }}
            >{pureMode ? '✧ 纯净' : '✦ 完整'}</button>
          )}
          <div style={{ position: 'relative' }}>
            <button
              onClick={openModelPanel}
              title="切换当前对话的模型"
              style={{ padding: '5px 12px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
            >{(currentModel || '').replace(/^anthropic\//, '') || '选择模型'} ▾</button>

            {modelPanelOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setModelPanelOpen(false)} />
                <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, zIndex: 91, width: '270px', maxHeight: '320px', overflowY: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px' }}>
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
                        <span>跟随全局默认（设置里的模型）</span>
                        {!conversation?.model && <span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="input-wrapper" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <input type="file" ref={fileInputRef} accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageSelect} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="添加图片"
          >+</button>
          <textarea ref={textareaRef} className="input-box" placeholder="" value={input} onChange={e => setInput(e.target.value)} rows={1} />
          <button className="send-btn" onClick={isStreaming ? onStop : handleSend} disabled={!isStreaming && !input.trim() && pendingImages.length === 0} title={isStreaming ? '停止生成' : '发送'}>{isStreaming ? '■' : '♥'}</button>
        </div>
      </div>
    </div>
  )
}
