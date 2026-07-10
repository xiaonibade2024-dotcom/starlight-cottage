import React, { useState, useRef, useEffect } from 'react'

// 压缩图片
function resizeImage(file, maxWidth = 800) {
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
        resolve(canvas.toDataURL('image/jpeg', 0.75))
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

export default function Chat({
  conversation, messages, isStreaming, cacheStats, variantIndexes,
  onSend, onToggleFavorite, onRegenerate, onEditMessage, onEditAndResend, onSwitchVariant,
  onMenuClick, onSettingsClick, onMemoryClick
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
  const editTextareaRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  useEffect(() => {
    if (editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.style.height = 'auto'
      editTextareaRef.current.style.height = editTextareaRef.current.scrollHeight + 'px'
    }
  }, [editingId])

  const handleScroll = () => {
    if (!messagesAreaRef.current) return
    setShowScrollBtn(messagesAreaRef.current.scrollHeight - messagesAreaRef.current.scrollTop - messagesAreaRef.current.clientHeight > 200)
  }

  const handleSend = () => {
    if ((!input.trim() && pendingImages.length === 0) || isStreaming) return

    if (pendingImages.length > 0) {
      // 发送多模态消息
      const content = JSON.stringify({ text: input.trim(), images: pendingImages })
      onSend(content)
      setPendingImages([])
    } else {
      onSend(input.trim())
    }
    setInput('')
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

  const handleMessageClick = (msgId, e) => {
    e.stopPropagation()
    if (editingId) return
    setActiveMessageId(prev => prev === msgId ? null : msgId)
  }
  const handleAreaClick = () => { if (!editingId) setActiveMessageId(null) }

  const startEdit = (msg) => {
    const { text } = parseContent(msg.content)
    setEditingId(msg.id)
    setEditContent(text)
    setActiveMessageId(null)
  }
  const saveEdit = () => { if (editContent.trim() && editingId) { onEditMessage(editingId, editContent); setEditingId(null); setEditContent('') } }
  const saveAndResend = () => { if (editContent.trim() && editingId) { onEditAndResend(editingId, editContent); setEditingId(null); setEditContent('') } }
  const cancelEdit = () => { setEditingId(null); setEditContent('') }

  const copyMessage = (content) => {
    const { text } = parseContent(content)
    navigator.clipboard.writeText(text).then(() => {
      const el = document.createElement('div')
      el.textContent = '已复制'
      el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 20px;border-radius:8px;font-size:13px;z-index:9999;pointer-events:none;'
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 1200)
    })
  }

  const isLastAssistantMsg = (msgId) => {
    const a = messages.filter(m => m.role === 'assistant' && !m.id?.startsWith('streaming-'))
    return a.length > 0 && a[a.length - 1].id === msgId
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (d.toDateString() === now.toDateString()) return '今天 ' + time
    if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + time
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + time
  }

  const renderTextContent = (text) => {
    if (!text) return null
    return text.split('\n\n').map((para, i) => {
      const lines = para.split('\n').map((line, j) => (
        <React.Fragment key={j}>{j > 0 && <br />}{renderInline(line)}</React.Fragment>
      ))
      return <p key={i}>{lines}</p>
    })
  }

  const renderInline = (text) => {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
      return part.split(/(\*[^*]+\*)/g).map((ip, j) => {
        if (ip.startsWith('*') && ip.endsWith('*') && !ip.startsWith('**')) return <em key={`${i}-${j}`}>{ip.slice(1, -1)}</em>
        return <React.Fragment key={`${i}-${j}`}>{ip}</React.Fragment>
      })
    })
  }

  // 渲染消息内容（支持图片）
  const renderMessageContent = (content) => {
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

  const actionBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '4px 8px', borderRadius: '6px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }
  const variantBtnStyle = { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', borderRadius: '4px' }

  return (
    <div className="main-area">
      <div className="chat-header">
        <div className="chat-header-left">
          <button className="menu-btn" onClick={onMenuClick}>☰</button>
          <span className="chat-header-title">{conversation?.name || '星月小屋'}</span>
        </div>
        <div className="chat-header-right">
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
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-bubble" onClick={(e) => handleMessageClick(msg.id, e)} style={{ cursor: editingId ? 'default' : 'pointer' }}>
              {editingId === msg.id ? (
                <div style={{ minWidth: '280px' }}>
                  <textarea ref={editTextareaRef} value={editContent} onChange={e => setEditContent(e.target.value)}
                    style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.5', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button onClick={cancelEdit} style={{ padding: '4px 14px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
                    <button onClick={saveEdit} style={{ padding: '4px 14px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>保存</button>
                    {msg.role === 'user' && (
                      <button onClick={saveAndResend} style={{ padding: '4px 14px', fontSize: '13px', border: 'none', borderRadius: '8px', background: 'var(--accent, #7c6ca8)', color: 'white', cursor: 'pointer' }}>保存并发送</button>
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
              {msg.variants && msg.variants.length > 1 && editingId !== msg.id && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                  <button style={variantBtnStyle} onClick={(e) => { e.stopPropagation(); const c = variantIndexes[msg.id] ?? 0; if (c > 0) onSwitchVariant(msg.id, c - 1) }} disabled={(variantIndexes[msg.id] ?? 0) <= 0}>◀</button>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'center' }}>{(variantIndexes[msg.id] ?? 0) + 1}/{msg.variants.length}</span>
                  <button style={variantBtnStyle} onClick={(e) => { e.stopPropagation(); const c = variantIndexes[msg.id] ?? 0; if (c < msg.variants.length - 1) onSwitchVariant(msg.id, c + 1) }} disabled={(variantIndexes[msg.id] ?? 0) >= msg.variants.length - 1}>▶</button>
                </span>
              )}
              {activeMessageId === msg.id && !msg.id?.startsWith('streaming-') && editingId !== msg.id && !isStreaming && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                  <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); startEdit(msg) }} title="编辑">✏️</button>
                  {msg.role === 'assistant' && isLastAssistantMsg(msg.id) && (
                    <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); onRegenerate(msg.id) }} title="重新生成">🔄</button>
                  )}
                  <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); copyMessage(msg.content) }} title="复制">📋</button>
                  {msg.role === 'assistant' && (
                    <button style={{ ...actionBtnStyle, color: msg.is_favorited ? '#e74c3c' : 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); onToggleFavorite(msg.id) }} title={msg.is_favorited ? '取消收藏' : '收藏'}>
                      {msg.is_favorited ? '♥' : '♡'}
                    </button>
                  )}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {(cacheStats.last_prompt > 0 || cacheStats.last_cached > 0) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '4px 12px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', flexWrap: 'wrap' }}>
          {cacheStats.last_prompt > 0 && <span>提示 {cacheStats.last_prompt}</span>}
          {cacheStats.last_completion > 0 && <span>回复 {cacheStats.last_completion}</span>}
          {(cacheStats.last_prompt > 0 || cacheStats.last_completion > 0) && <span>共 {(cacheStats.last_prompt || 0) + (cacheStats.last_completion || 0)}</span>}
          {cacheStats.last_cached > 0 && <span style={{ color: 'var(--accent, #7c6ca8)' }}>✦ 缓存命中 {cacheStats.last_cached}</span>}
        </div>
      )}

      {messages.length > 5 && (
        <button onClick={scrollToTop} title="回到顶部" style={{ position: 'absolute', right: '16px', bottom: showScrollBtn ? '130px' : '80px', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', opacity: 0.8, transition: 'opacity 0.2s, bottom 0.2s', zIndex: 10 }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}>↑</button>
      )}
      {showScrollBtn && (
        <button onClick={scrollToBottom} title="回到最新" style={{ position: 'absolute', right: '16px', bottom: '80px', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--accent, #7c6ca8)', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10 }}>↓</button>
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
        <div className="input-wrapper" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <input type="file" ref={fileInputRef} accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageSelect} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="添加图片"
          >+</button>
          <textarea ref={textareaRef} className="input-box" placeholder="" value={input} onChange={e => setInput(e.target.value)} rows={1} disabled={isStreaming} />
          <button className="send-btn" onClick={handleSend} disabled={(!input.trim() && pendingImages.length === 0) || isStreaming} title="发送">{isStreaming ? '…' : '♥'}</button>
        </div>
      </div>
    </div>
  )
}
