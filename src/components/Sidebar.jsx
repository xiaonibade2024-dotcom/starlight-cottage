import React, { useState } from 'react'

// 钢笔画线条图标（内联 SVG，无任何依赖）
const IC = {
  dots: <><circle cx="12" cy="5.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none" /></>,
  pencil: <><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3" /><path d="M13.5 6.5l3 3" /></>,
  fileText: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 13h6" /><path d="M9 17h4" /></>,
  code: <><path d="M9 8l-4 4 4 4" /><path d="M15 8l4 4-4 4" /></>,
  trash: <><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6.5 7l1 12.2a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12.2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  sliders: <><path d="M4 7h3.5" /><circle cx="9.5" cy="7" r="2" /><path d="M11.5 7H20" /><path d="M4 12h8.5" /><circle cx="14.5" cy="12" r="2" /><path d="M16.5 12H20" /><path d="M4 17h1.5" /><circle cx="7.5" cy="17" r="2" /><path d="M9.5 17H20" /></>,
  download: <><path d="M12 4v11" /><path d="M7.5 11.5L12 16l4.5-4.5" /><path d="M5 20h14" /></>
}

function Icon({ name, size = 15, sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      {IC[name]}
    </svg>
  )
}

const menuRowStyle = { display: 'flex', alignItems: 'center', gap: '9px' }

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
              <button title="操作" onClick={e => openItemMenu(e, conv)}><Icon name="dots" size={17} /></button>
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
        <button onClick={onOpenSettings}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><Icon name="sliders" size={13} /> 设置</span></button>
        <button onClick={onExportAll}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}><Icon name="download" size={13} /> 导出全部</span></button>
      </div>

      {itemMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 120 }} onClick={e => { e.stopPropagation(); setItemMenu(null) }} />
          <div style={{ position: 'fixed', left: Math.max(8, itemMenu.x - 170), top: itemMenu.y, zIndex: 121, width: '170px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: '4px', overflow: 'hidden' }}>
            <div onClick={menuRename}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '9px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}><span style={menuRowStyle}><Icon name="pencil" /> 重命名</span></div>
            <div onClick={e => menuExport(e, 'md')}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '9px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}><span style={menuRowStyle}><Icon name="fileText" /> 导出 Markdown</span></div>
            <div onClick={e => menuExport(e, 'json')}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '9px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}><span style={menuRowStyle}><Icon name="code" /> 导出 JSON</span></div>
            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 6px' }} />
            <div onClick={menuDelete}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(196, 112, 112, 0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '9px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', color: '#c47070' }}><span style={menuRowStyle}><Icon name="trash" /> 删除对话</span></div>
          </div>
        </>
      )}
    </div>
  )
}
