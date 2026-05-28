import React, { useState } from 'react'

export default function Sidebar({
  conversations,
  activeConvId,
  isOpen,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onExport,
  onExportAll,
  onOpenSettings
}) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const startRename = (e, conv) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditName(conv.name)
  }

  const confirmRename = (convId) => {
    if (editName.trim()) {
      onRename(convId, editName.trim())
    }
    setEditingId(null)
  }

  const handleKeyDown = (e, convId) => {
    if (e.key === 'Enter') confirmRename(convId)
    if (e.key === 'Escape') setEditingId(null)
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now - d
    if (diff < 86400000) { // 今天
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    if (diff < 172800000) return '昨天'
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span className="star">✦</span>
          星月小屋
        </div>
        <div className="sidebar-subtitle">a place to call home</div>
        <button className="new-chat-btn" onClick={() => onCreate()}>
          ＋ 新对话
        </button>
      </div>

      <div className="chat-list">
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`chat-item ${conv.id === activeConvId ? 'active' : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === conv.id ? (
                <div className="chat-item-name">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => confirmRename(conv.id)}
                    onKeyDown={e => handleKeyDown(e, conv.id)}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              ) : (
                <>
                  <div className="chat-item-name">{conv.name}</div>
                  <div className="chat-item-time">{formatTime(conv.updated_at)}</div>
                </>
              )}
            </div>
            <div className="chat-item-actions">
              <button title="重命名" onClick={e => startRename(e, conv)}>✎</button>
              <button title="导出" onClick={e => { e.stopPropagation(); onExport(conv.id) }}>↓</button>
              <button className="delete" title="删除" onClick={e => {
                e.stopPropagation()
                if (confirm('确定要删除这个对话吗？')) onDelete(conv.id)
              }}>×</button>
            </div>
          </div>
        ))}

        {conversations.length === 0 && (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
            lineHeight: '1.8'
          }}>
            还没有对话<br />点击上方创建一个吧
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button onClick={onOpenSettings}>⚙ 设置</button>
        <button onClick={onExportAll}>↓ 导出全部</button>
      </div>
    </div>
  )
}
