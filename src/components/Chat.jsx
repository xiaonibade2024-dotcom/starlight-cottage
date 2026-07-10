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
  onSwitchVariant,
  onMenuClick,
  onSettingsClick,
  onMemoryClick
}) {
  const [input, setInput] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const messagesEndRef = useRef(null)
  const messagesTopRef = useRef(null)
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

  // 编辑时自动聚焦和调整高度
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
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distanceFromBottom > 200)
  }

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
    }
  }

  const scrollToTop = () => {
    messagesAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 开始编辑
  const startEdit = (msg) => {
    setEditingId(msg.id)
    setEditContent(msg.content)
  }

  // 保存编辑
  const saveEdit = () => {
    if (editContent.trim() && editingId) {
      onEditMessage(editingId, editContent)
      setEditingId(null)
      setEditContent('')
    }
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  // 判断是否是最后一条 AI 消息
  const isLastAssistantMsg = (msgId) => {
    const assistantMsgs = messages.filter(m => m.role === 'assistant' && !m.id?.startsWith('streaming-'))
    return assistantMsgs.length > 0 && assistantMsgs[assistantMsgs.length - 1].id === msgId
  }

  // 判断是否是最后一条用户消息
  const isLastUserMsg = (msgId) => {
    const userMsgs = messages.filter(m => m.role === 'user')
    return userMsgs.length > 0 && userMsgs[userMsgs.length - 1].id === msgId
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const isThisYear = d.getFullYear() === now.getFullYear()

    const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

    if (isToday) {
      return '今天 ' + time
    } else if (isThisYear) {
      return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + time
    } else {
      return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' + time
    }
  }

  const renderContent = (content) => {
    if (!content) return null
    const paragraphs = content.split('\n\n')
    return paragraphs.map((para, i) => {
      const lines = para.split('\n').map((line, j) => (
        <React.Fragment key={j}>
          {j > 0 && <br />}
          {renderInline(line)}
        </React.Fragment>
      ))
      return <p key={i}>{lines}</p>
    })
  }

  const renderInline = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      const italicParts = part.split(/(\*[^*]+\*)/g)
      return italicParts.map((ip, j) => {
        if (ip.startsWith('*') && ip.endsWith('*') && !ip.startsWith('**')) {
          return <em key={`${i}-${j}`}>{ip.slice(1, -1)}</em>
        }
        return <React.Fragment key={`${i}-${j}`}>{ip}</React.Fragment>
      })
    })
  }

  // 版本切换按钮样式
  const variantBtnStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
    borderRadius: '4px'
  }

  const actionBtnStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '2px 8px',
    borderRadius: '4px',
    opacity: 0.6
  }

  return (
    <div className="main-area">
      {/* 头部 */}
      <div className="chat-header">
        <div className="chat-header-left">
          <button className="menu-btn" onClick={onMenuClick}>☰</button>
          <span className="chat-header-title">
            {conversation?.name || '星月小屋'}
          </span>
        </div>
        <div className="chat-header-right">
          <button className="header-btn" title="记忆" onClick={onMemoryClick}>💭</button>
          <button className="header-btn" title="设置" onClick={onSettingsClick}>⚙</button>
        </div>
      </div>

      {/* 消息区域 */}
      <div
        className="messages-area"
        ref={messagesAreaRef}
        onScroll={handleScroll}
      >
        <div ref={messagesTopRef} />

        {messages.length === 0 && !conversation && (
          <div className="empty-state">
            <div className="empty-state-icon">🌙</div>
            <div className="empty-state-text">
              欢迎来到星月小屋<br />
              在这里，每一句对话都会被温柔地记住
            </div>
          </div>
        )}

        {messages.length === 0 && conversation && (
          <div className="empty-state">
            <div className="empty-state-text" style={{ color: 'var(--text-muted)' }}>
              新的对话，新的开始
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-bubble">
              {/* 编辑模式 */}
              {editingId === msg.id ? (
                <div>
                  <textarea
                    ref={editTextareaRef}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '60px',
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={cancelEdit}
                      style={{
                        padding: '4px 16px',
                        fontSize: '13px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={saveEdit}
                      style={{
                        padding: '4px 16px',
                        fontSize: '13px',
                        border: 'none',
                        borderRadius: '8px',
                        background: 'var(--accent, #7c6ca8)',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {renderContent(msg.content)}
                  {msg.role === 'assistant' && msg.id?.startsWith('streaming-') && isStreaming && !msg.content && (
                    <div className="typing-indicator">
                      <span /><span /><span />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="message-meta">
              <span className="message-time">{formatTime(msg.created_at)}</span>

              {/* 版本切换 */}
              {msg.variants && msg.variants.length > 1 && editingId !== msg.id && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                  <button
                    style={variantBtnStyle}
                    onClick={() => {
                      const current = variantIndexes[msg.id] ?? 0
                      if (current > 0) onSwitchVariant(msg.id, current - 1)
                    }}
                    disabled={(variantIndexes[msg.id] ?? 0) <= 0}
                  >
                    ◀
                  </button>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'center' }}>
                    {(variantIndexes[msg.id] ?? 0) + 1}/{msg.variants.length}
                  </span>
                  <button
                    style={variantBtnStyle}
                    onClick={() => {
                      const current = variantIndexes[msg.id] ?? 0
                      if (current < msg.variants.length - 1) onSwitchVariant(msg.id, current + 1)
                    }}
                    disabled={(variantIndexes[msg.id] ?? 0) >= msg.variants.length - 1}
                  >
                    ▶
                  </button>
                </span>
              )}

              {/* 操作按钮 */}
              {!msg.id?.startsWith('streaming-') && editingId !== msg.id && !isStreaming && (
                <>
                  {/* 用户消息：编辑按钮 */}
                  {msg.role === 'user' && (
                    <button
                      style={actionBtnStyle}
                      onClick={() => startEdit(msg)}
                      title="编辑"
                    >
                      ✏️
                    </button>
                  )}

                  {/* AI 消息：重新生成 + 收藏 */}
                  {msg.role === 'assistant' && isLastAssistantMsg(msg.id) && (
                    <button
                      style={actionBtnStyle}
                      onClick={() => onRegenerate(msg.id)}
                      title="重新生成"
                    >
                      🔄
                    </button>
                  )}

                  {msg.role === 'assistant' && (
                    <button
                      className={`message-favorite ${msg.is_favorited ? 'active' : ''}`}
                      onClick={() => onToggleFavorite(msg.id)}
                      title={msg.is_favorited ? '取消收藏' : '收藏到回忆匣子'}
                    >
                      {msg.is_favorited ? '♥' : '♡'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Token 信息栏 */}
      {(cacheStats.last_prompt > 0 || cacheStats.last_cached > 0) && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          padding: '4px 12px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-primary)',
          flexWrap: 'wrap'
        }}>
          {cacheStats.last_prompt > 0 && (
            <span>提示 {cacheStats.last_prompt}</span>
          )}
          {cacheStats.last_completion > 0 && (
            <span>回复 {cacheStats.last_completion}</span>
          )}
          {(cacheStats.last_prompt > 0 || cacheStats.last_completion > 0) && (
            <span>共 {(cacheStats.last_prompt || 0) + (cacheStats.last_completion || 0)}</span>
          )}
          {cacheStats.last_cached > 0 && (
            <span style={{ color: 'var(--accent, #7c6ca8)' }}>
              ✦ 缓存命中 {cacheStats.last_cached}
            </span>
          )}
        </div>
      )}

      {/* 浮动滚动按钮 */}
      {messages.length > 5 && (
        <button
          onClick={scrollToTop}
          title="回到顶部"
          style={{
            position: 'absolute',
            right: '16px',
            bottom: showScrollBtn ? '130px' : '80px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            opacity: 0.8,
            transition: 'opacity 0.2s, bottom 0.2s',
            zIndex: 10
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
        >
          ↑
        </button>
      )}

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          title="回到最新"
          style={{
            position: 'absolute',
            right: '16px',
            bottom: '80px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--accent, #7c6ca8)',
            color: 'white',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 10
          }}
        >
          ↓
        </button>
      )}

      {/* 输入区域 */}
      <div className="input-area">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="input-box"
            placeholder=""
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={1}
            disabled={isStreaming}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            title="发送"
          >
            {isStreaming ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}
