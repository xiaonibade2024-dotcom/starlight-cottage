import React, { useState, useRef, useEffect } from 'react'

export default function Chat({
  conversation,
  messages,
  isStreaming,
  cacheStats,
  variantIndexes,
  onSend,
  onToggleFavorite,
  onRegenerate,
  onEditMessage,
  onEditAndResend,
  onSwitchVariant,
  onMenuClick,
  onSettingsClick,
  onMemoryClick
}) {
  const [input, setInput] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [activeMessageId, setActiveMessageId] = useState(null)
  const messagesEndRef = useRef(null)
  const messagesAreaRef = useRef(null)
  const textareaRef = useRef(null)
  const editTextareaRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    const el = messagesAreaRef.current
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
  }

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '44px'
  }

  const scrollToTop = () => { messagesAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }
  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  // 点击消息气泡 → 显示/隐藏操作栏
  const handleMessageClick = (msgId, e) => {
    e.stopPropagation()
    if (editingId) return
    setActiveMessageId(prev => prev === msgId ? null : msgId)
  }

  // 点击消息区域空白处 → 隐藏操作栏
  const handleAreaClick = () => {
    if (!editingId) setActiveMessageId(null)
  }

  const startEdit = (msg) => {
    setEditingId(msg.id)
    setEditContent(msg.content)
    setActiveMessageId(null)
  }

  const saveEdit = () => {
    if (editContent.trim() && editingId) {
      onEditMessage(editingId, editContent)
      setEditingId(null)
      setEditContent('')
    }
  }

  const saveAndResend = () => {
    if (editContent.trim() && editingId) {
      onEditAndResend(editingId, editContent)
      setEditingId(null)
      setEditContent('')
    }
  }

  const cancelEdit = () => { setEditingId(null); setEditContent('') }

  const copyMessage = (content) => {
    navigator.clipboard.writeText(content).then(() => {
      // 简单的复制成功提示
      const el = document.createElement('div')
      el.textContent = '已复制'
      el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.7);color:white;padding:8px 20px;border-radius:8px;font-size:13px;z-index:9999;pointer-events:none;'
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 1200)
    })
  }

  const isLastAssistantMsg = (msgId) => {
    const assistantMsgs = messages.filter(m => m.role === 'assistant' && !m.id?.startsWith('streaming-'))
    return assistantMsgs.length > 0 && assistantMsgs[assistantMsgs.length - 1].id === msgId
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const isThisYear = d.getFullYear() === now.getFullYear()
    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return '今天 ' + time
    if (isThisYear) return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + time
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + time
  }

  const renderContent = (content) => {
    if (!content) return null
    return content.split('\n\n').map((para, i) => {
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

  const actionBtnStyle = {
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '4px 8px', borderRadius: '6px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px'
  }

  const variantBtnStyle = {
    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', borderRadius: '4px'
  }

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
            <div
              className="message-bubble"
              onClick={(e) => handleMessageClick(msg.id, e)}
              style={{ cursor: editingId ? 'default' : 'pointer' }}
            >
              {editingId === msg.id ? (
                <div>
                  <textarea
                    ref={editTextareaRef}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    style={{
                      width: '100%', minHeight: '60px', padding: '8px',
                      border: '1px solid var(--border)', borderRadius: '8px',
                      background: 'var(--bg-primary)', color: 'var(--text-primary)',
                      fontSize: '14px', lineHeight: '1.5', resize: 'vertical',
                      fontFamily: 'inherit', boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button onClick={cancelEdit} style={{ padding: '4px 14px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      取消
                    </button>
                    <button onClick={saveEdit} style={{ padding: '4px 14px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      保存
                    </button>
                    {msg.role === 'user' && (
                      <button onClick={saveAndResend} style={{ padding: '4px 14px', fontSize: '13px', border: 'none', borderRadius: '8px', background: 'var(--accent, #7c6ca8)', color: 'white', cursor: 'pointer' }}>
                        保存并发送
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {renderContent(msg.content)}
                  {msg.role === 'assistant' && msg.id?.startsWith('streaming-') && isStreaming && !msg.content && (
                    <div className="typing-indicator"><span /><span /><span /></div>
                  )}
                </>
              )}
            </div>

            {/* 消息底部信息栏 */}
            <div className="message-meta">
              <span className="message-time">{formatTime(msg.created_at)}</span>

              {/* 版本切换（始终显示） */}
              {msg.variants && msg.variants.length > 1 && editingId !== msg.id && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                  <button style={variantBtnStyle} onClick={(e) => { e.stopPropagation(); const c = variantIndexes[msg.id] ?? 0; if (c > 0) onSwitchVariant(msg.id, c - 1) }} disabled={(variantIndexes[msg.id] ?? 0) <= 0}>◀</button>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'center' }}>{(variantIndexes[msg.id] ?? 0) + 1}/{msg.variants.length}</span>
                  <button style={variantBtnStyle} onClick={(e) => { e.stopPropagation(); const c = variantIndexes[msg.id] ?? 0; if (c < msg.variants.length - 1) onSwitchVariant(msg.id, c + 1) }} disabled={(variantIndexes[msg.id] ?? 0) >= msg.variants.length - 1}>▶</button>
                </span>
              )}

              {/* 操作按钮（仅选中时显示） */}
              {activeMessageId === msg.id && !msg.id?.startsWith('streaming-') && editingId !== msg.id && !isStreaming && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                  <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); startEdit(msg) }} title="编辑">✏️</button>
                  {msg.role === 'assistant' && isLastAssistantMsg(msg.id) && (
                    <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); onRegenerate(msg.id) }} title="重新生成">🔄</button>
                  )}
                  <button style={actionBtnStyle} onClick={(e) => { e.stopPropagation(); copyMessage(msg.content) }} title="复制">📋</button>
                  {msg.role === 'assistant' && (
                    <button
                      style={{ ...actionBtnStyle, color: msg.is_favorited ? '#e74c3c' : 'var(--text-muted)' }}
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(msg.id) }}
                      title={msg.is_favorited ? '取消收藏' : '收藏'}
                    >
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

      {/* Token 信息栏 */}
      {(cacheStats.last_prompt > 0 || cacheStats.last_cached > 0) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '4px 12px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', flexWrap: 'wrap' }}>
          {cacheStats.last_prompt > 0 && <span>提示 {cacheStats.last_prompt}</span>}
          {cacheStats.last_completion > 0 && <span>回复 {cacheStats.last_completion}</span>}
          {(cacheStats.last_prompt > 0 || cacheStats.last_completion > 0) && <span>共 {(cacheStats.last_prompt || 0) + (cacheStats.last_completion || 0)}</span>}
          {cacheStats.last_cached > 0 && <span style={{ color: 'var(--accent, #7c6ca8)' }}>✦ 缓存命中 {cacheStats.last_cached}</span>}
        </div>
      )}

      {/* 滚动按钮 */}
      {messages.length > 5 && (
        <button onClick={scrollToTop} title="回到顶部" style={{ position: 'absolute', right: '16px', bottom: showScrollBtn ? '130px' : '80px', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', opacity: 0.8, transition: 'opacity 0.2s, bottom 0.2s', zIndex: 10 }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}>↑</button>
      )}
      {showScrollBtn && (
        <button onClick={scrollToBottom} title="回到最新" style={{ position: 'absolute', right: '16px', bottom: '80px', width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--accent, #7c6ca8)', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10 }}>↓</button>
      )}

      <div className="input-area">
        <div className="input-wrapper">
          <textarea ref={textareaRef} className="input-box" placeholder="" value={input} onChange={e => setInput(e.target.value)} rows={1} disabled={isStreaming} />
          <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isStreaming} title="发送">{isStreaming ? '…' : '↑'}</button>
        </div>
      </div>
    </div>
  )
}
