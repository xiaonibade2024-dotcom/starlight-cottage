import React, { useState, useRef, useEffect } from 'react'

export default function Chat({
  conversation,
  messages,
  isStreaming,
  cacheStats,
  onSend,
  onToggleFavorite,
  onMenuClick,
  onSettingsClick,
  onMemoryClick
}) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
    }
  }

  // Enter 只换行，不发送。发送统一用发送按钮。
  // 不需要 handleKeyDown 拦截 Enter 了。

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 简单的 Markdown 渲染
  const renderContent = (content) => {
    if (!content) return null
    
    // 分段落
    const paragraphs = content.split('\n\n')
    return paragraphs.map((para, i) => {
      // 处理单个换行
      const lines = para.split('\n').map((line, j) => (
        <React.Fragment key={j}>
          {j > 0 && <br />}
          {renderInline(line)}
        </React.Fragment>
      ))
      return <p key={i}>{lines}</p>
    })
  }

  // 行内格式化（加粗、斜体）
  const renderInline = (text) => {
    // 加粗 **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      // 斜体 *text*
      const italicParts = part.split(/(\*[^*]+\*)/g)
      return italicParts.map((ip, j) => {
        if (ip.startsWith('*') && ip.endsWith('*') && !ip.startsWith('**')) {
          return <em key={`${i}-${j}`}>{ip.slice(1, -1)}</em>
        }
        return <React.Fragment key={`${i}-${j}`}>{ip}</React.Fragment>
      })
    })
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
          {cacheStats.last_cached > 0 && (
            <div className="cache-indicator">
              <div className="cache-dot" />
              <span>缓存命中 {cacheStats.last_cached} tokens</span>
            </div>
          )}
          <button className="header-btn" title="记忆" onClick={onMemoryClick}>💭</button>
          <button className="header-btn" title="设置" onClick={onSettingsClick}>⚙</button>
        </div>
      </div>

      {/* 消息区域 */}
      <div className="messages-area">
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
              {renderContent(msg.content)}
              {msg.role === 'assistant' && msg.id?.startsWith('streaming-') && isStreaming && !msg.content && (
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
              )}
            </div>
            <div className="message-meta">
              <span className="message-time">{formatTime(msg.created_at)}</span>
              {msg.role === 'assistant' && !msg.id?.startsWith('streaming-') && (
                <button
                  className={`message-favorite ${msg.is_favorited ? 'active' : ''}`}
                  onClick={() => onToggleFavorite(msg.id)}
                  title={msg.is_favorited ? '取消收藏' : '收藏到回忆匣子'}
                >
                  {msg.is_favorited ? '♥' : '♡'}
                </button>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

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
