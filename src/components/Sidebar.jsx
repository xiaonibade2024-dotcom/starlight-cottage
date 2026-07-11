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
  const [itemMenu, setItemMenu] = useState(null) // { conv, x, y }

  const openItemMenu = (e, conv) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    setItemMenu(itemMenu?.conv?.id === conv.id ? null : { conv, x: r.right, y: Math.min(r.bottom + 4, window.innerHeight - 210) })
  }

  const menuRename = (e) => {
    e.stopPropagation()
    setEditingId(itemMenu.conv.id)
    setEditName(itemMenu.conv.name)
    setItemMenu(null)
  }

  const menuExport = (e, format) => {
    e.stopPropagation()
    onExport(itemMenu.conv.id, format)
    setItemMenu(null)
  }

  const menuDelete = (e) => {
    e.stopPropagation()
    const id = itemMenu.conv.id
    setItemMenu(null)
    if (confirm('确定要删除这个对话吗？')) onDelete(id)
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
              <button title="操作" onClick={e => openItemMenu(e, conv)}>⋮</button>
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

      {itemMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 120 }} onClick={e => { e.stopPropagation(); setItemMenu(null) }} />
          <div style={{ position: 'fixed', left: Math.max(8, itemMenu.x - 170), top: itemMenu.y, zIndex: 121, width: '170px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: '4px', overflow: 'hidden' }}>
            <div onClick={menuRename}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '9px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>✎ 重命名</div>
            <div onClick={e => menuExport(e, 'md')}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '9px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>📝 导出 Markdown</div>
            <div onClick={e => menuExport(e, 'json')}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '9px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>💾 导出 JSON</div>
            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 6px' }} />
            <div onClick={menuDelete}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(196, 112, 112, 0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '9px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', color: '#c47070' }}>🗑 删除对话</div>
          </div>
        </>
      )}
    </div>
  )
}
