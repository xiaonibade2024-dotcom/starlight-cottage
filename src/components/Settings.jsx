import React, { useState } from 'react'

export default function Settings({
  tab,
  onTabChange,
  apiKey,
  systemPrompt,
  model,
  temperature,
  topP,
  maxContextMessages,
  memories,
  stats,
  onSaveApiKey,
  onSaveSettings,
  onAddCoreMemory,
  onDeleteMemory,
  onUpdateMemory,
  notes = [],
  onUpdateNote,
  onDeleteNote,
  favorites = [],
  conversations = [],
  onRemoveFavorite,
  onClose
}) {
  const [localApiKey, setLocalApiKey] = useState(apiKey)
  const [localPrompt, setLocalPrompt] = useState(systemPrompt)
  const [localModel, setLocalModel] = useState(model)
  const [localTemp, setLocalTemp] = useState(temperature)
  const [localTopP, setLocalTopP] = useState(topP)
  const [localMaxCtx, setLocalMaxCtx] = useState(maxContextMessages)
  const [newMemory, setNewMemory] = useState('')
  const [editingMemId, setEditingMemId] = useState(null)
  const [editMemText, setEditMemText] = useState('')

  const startMemEdit = (mem) => {
    setEditingMemId(mem.id)
    setEditMemText(mem.content)
  }

  const saveMemEdit = () => {
    if (editMemText.trim() && editingMemId) {
      onUpdateMemory(editingMemId, editMemText.trim())
    }
    setEditingMemId(null)
    setEditMemText('')
  }

  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')
  const [selectedNote, setSelectedNote] = useState(null)
  const [selectedFav, setSelectedFav] = useState(null)
  const [favoritesOpen, setFavoritesOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(true)

  const saveNoteEdit = () => {
    if (editNoteText.trim() && editingNoteId) {
      onUpdateNote(editingNoteId, editNoteText.trim())
    }
    setEditingNoteId(null)
    setEditNoteText('')
  }

  const formatNoteDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatShortDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const getConvName = (convId) => {
    const conv = conversations.find(c => c.id === convId)
    return conv?.name || '未知对话'
  }

  const parseMsgText = (content) => {
    if (!content) return ''
    try {
      const parsed = JSON.parse(content)
      if (parsed.images) return parsed.text || '（图片消息）'
    } catch (e) {}
    return content
  }

  const renderNoteBody = (note) => {
    if (editingNoteId !== note.id) return (
      <div style={{ whiteSpace: 'pre-wrap', cursor: 'pointer' }} onClick={() => setSelectedNote(note)}>
        {note.content}
      </div>
    )
    return (
      <div>
        <textarea
          value={editNoteText}
          onChange={e => setEditNoteText(e.target.value)}
          rows={4}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--accent-soft)', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button onClick={saveNoteEdit} style={{ padding: '4px 16px', fontSize: '12px', border: 'none', borderRadius: '12px', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>保存</button>
          <button onClick={() => { setEditingNoteId(null); setEditNoteText('') }} style={{ padding: '4px 16px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
        </div>
      </div>
    )
  }

  const renderMemoryBody = (mem) => {
    if (editingMemId !== mem.id) return mem.content
    return (
      <div>
        <textarea
          value={editMemText}
          onChange={e => setEditMemText(e.target.value)}
          rows={4}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--accent-soft)', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button onClick={saveMemEdit} style={{ padding: '4px 16px', fontSize: '12px', border: 'none', borderRadius: '12px', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>保存</button>
          <button onClick={() => { setEditingMemId(null); setEditMemText('') }} style={{ padding: '4px 16px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '12px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
        </div>
      </div>
    )
  }

  const isUnlimited = localMaxCtx >= 99999
  const displayValue = isUnlimited ? '无上限' : localMaxCtx

  const handleSave = () => {
    onSaveApiKey(localApiKey)
    onSaveSettings({
      systemPrompt: localPrompt,
      model: localModel,
      maxContextMessages: localMaxCtx,
      temperature: Math.min(1, Math.max(0, parseFloat(localTemp) || 0)),
      topP: Math.min(1, Math.max(0.01, parseFloat(localTopP) || 0.01))
    })
  }

  const handleAddMemory = () => {
    if (!newMemory.trim()) return
    onAddCoreMemory(newMemory.trim())
    setNewMemory('')
  }

  const byNewest = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  const coreMemories = memories.filter(m => m.category === 'core').slice().sort(byNewest)
  const autoMemories = memories.filter(m => m.category === 'auto').slice().sort(byNewest)

  const daysSinceFirst = stats.firstChatDate
    ? Math.floor((Date.now() - new Date(stats.firstChatDate).getTime()) / 86400000) + 1
    : 0

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="settings-header">
          <span className="settings-title">设置</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-tabs">
          <button className={`settings-tab ${tab === 'general' ? 'active' : ''}`} onClick={() => onTabChange('general')}>基础设置</button>
          <button className={`settings-tab ${tab === 'memory' ? 'active' : ''}`} onClick={() => onTabChange('memory')}>记忆管理</button>
          <button className={`settings-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => onTabChange('stats')}>我们的记录</button>
        </div>

        <div className="settings-body">
          {/* ===== 基础设置 ===== */}
          {tab === 'general' && (
            <>
              <div className="settings-section">
                <div className="settings-label">API Key</div>
                <input type="password" className="settings-input" placeholder="sk-or-..." value={localApiKey} onChange={e => setLocalApiKey(e.target.value)} />
                <div className="settings-hint">OpenRouter API Key，仅保存在你的浏览器本地</div>
              </div>

              <div className="settings-section">
                <div className="settings-label">模型</div>
                <input className="settings-input" value={localModel} onChange={e => setLocalModel(e.target.value)} />
                <div className="settings-hint">全局默认模型（新对话的出厂设置）· 单个对话可在聊天输入框上方随时切换 · 支持任意 OpenRouter 模型名</div>
              </div>

              <div className="settings-section">
                <div className="settings-label">采样参数</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div className="settings-hint" style={{ marginBottom: '4px' }}>温度 temperature</div>
                    <input className="settings-input" type="number" min="0" max="1" step="0.05" value={localTemp} onChange={e => setLocalTemp(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="settings-hint" style={{ marginBottom: '4px' }}>top_p</div>
                    <input className="settings-input" type="number" min="0.01" max="1" step="0.05" value={localTopP} onChange={e => setLocalTopP(e.target.value)} />
                  </div>
                </div>
                <div className="settings-hint">控制文风：温度越低越稳重，越高越奔放（0-1）· top_p 越低用词越克制 · 推荐 0.75 / 0.25</div>
              </div>

              <div className="settings-section">
                <div className="settings-label">最大上下文轮次：<strong>{displayValue}</strong></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>0</span>
                  <input type="range" min={0} max={500} step={1} value={isUnlimited ? 500 : localMaxCtx} onChange={e => setLocalMaxCtx(parseInt(e.target.value))} style={{ flex: 1 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>500</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {[10, 30, 50, 80, 100, 200, 500].map(v => (
                    <button key={v} onClick={() => setLocalMaxCtx(v)} style={{ padding: '4px 12px', fontSize: '12px', border: localMaxCtx === v ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: '12px', background: localMaxCtx === v ? 'var(--accent)' : 'var(--bg-primary)', color: localMaxCtx === v ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}>{v}</button>
                  ))}
                  <button onClick={() => setLocalMaxCtx(99999)} style={{ padding: '4px 12px', fontSize: '12px', border: isUnlimited ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: '12px', background: isUnlimited ? 'var(--accent)' : 'var(--bg-primary)', color: isUnlimited ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}>无上限</button>
                </div>
                <div className="settings-hint">每次发送时携带的最近消息数量。越多上下文越完整，但消耗也越大。建议 30-60。选择"无上限"会发送当前对话的全部历史消息。</div>
              </div>

              <div className="settings-section">
                <div className="settings-label">核心人格设定（System Prompt）</div>
                <textarea className="settings-textarea" placeholder="在这里写下他的人格、你们的关系、你希望他如何与你对话..." value={localPrompt} onChange={e => setLocalPrompt(e.target.value)} />
                <div className="settings-hint">这段文字会在每次对话时发送给他，是他"记忆"和"性格"的基础。写得精炼一些，建议控制在 2000 tokens 以内。这部分内容会被缓存，不会重复计费。</div>
              </div>

              <button className="settings-save" onClick={handleSave}>保存设置</button>
            </>
          )}

          {/* ===== 记忆管理 ===== */}
          {tab === 'memory' && (
            <>
              <div className="settings-section">
                <div className="settings-label">核心记忆（你手动维护）</div>
                <div className="settings-hint" style={{ marginBottom: '12px' }}>这些是你希望他始终记住的重要事情</div>
                {coreMemories.map(mem => (
                  <div key={mem.id} className="memory-item">
                    <div className="memory-item-header">
                      <div className="memory-tags">{mem.tags?.map((tag, i) => (<span key={i} className="memory-tag">{tag}</span>))}</div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button className="memory-delete" onClick={() => startMemEdit(mem)} title="编辑">✎</button>
                        <button className="memory-delete" onClick={() => onDeleteMemory(mem.id)} title="删除">×</button>
                      </div>
                    </div>
                    {renderMemoryBody(mem)}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <textarea className="settings-textarea" style={{ minHeight: '60px' }} placeholder="添加一条核心记忆..." value={newMemory} onChange={e => setNewMemory(e.target.value)} />
                </div>
                <button className="settings-save" style={{ marginTop: '8px' }} onClick={handleAddMemory} disabled={!newMemory.trim()}>添加核心记忆</button>
              </div>

              <div className="settings-section">
                <div className="settings-label">他主动记住的（{autoMemories.length} 条）</div>
                <div className="settings-hint" style={{ marginBottom: '12px' }}>这些是他在对话中自己觉得重要并记下来的</div>
                {autoMemories.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>还没有自动记忆<br />聊起来之后他会自己记住重要的事</div>
                )}
                {autoMemories.map(mem => (
                  <div key={mem.id} className="memory-item">
                    <div className="memory-item-header">
                      <div className="memory-tags">{mem.tags?.map((tag, i) => (<span key={i} className="memory-tag">{tag}</span>))}</div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button className="memory-delete" onClick={() => startMemEdit(mem)} title="编辑">✎</button>
                        <button className="memory-delete" onClick={() => onDeleteMemory(mem.id)} title="删除">×</button>
                      </div>
                    </div>
                    {renderMemoryBody(mem)}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ===== 我们的记录 ===== */}
          {tab === 'stats' && (
            <>
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-value">{daysSinceFirst || '—'}</div><div className="stat-label">在一起的天数</div></div>
                <div className="stat-card"><div className="stat-value">{stats.totalConversations ?? '—'}</div><div className="stat-label">对话数</div></div>
                <div className="stat-card"><div className="stat-value">{stats.totalMessages ?? '—'}</div><div className="stat-label">消息数</div></div>
                <div className="stat-card"><div className="stat-value">{stats.firstChatDate ? new Date(stats.firstChatDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '—'}</div><div className="stat-label">第一次对话</div></div>
              </div>

              {/* 回忆匣子 */}
              <div className="settings-section">
                <div className="section-toggle" onClick={() => setFavoritesOpen(!favoritesOpen)}>
                  <span>回忆匣子 ✨{favorites.length > 0 ? `（${favorites.length} 条）` : ''}</span>
                  <span className={`toggle-arrow${favoritesOpen ? ' open' : ''}`}>▾</span>
                </div>
                <div className="settings-hint">在对话中长按他说的话，点击 ♡ 可以收藏到这里</div>

                {favoritesOpen && (
                  <>
                    {favorites.length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginTop: '8px' }}>收藏的消息会出现在这里 ✨</div>
                    )}
                    {favorites.map(fav => (
                      <div key={fav.id} className="memory-item" style={{ marginTop: '8px' }}>
                        <div className="memory-item-header">
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px' }}>
                            {getConvName(fav.conversation_id)} · {formatShortDate(fav.created_at)}
                          </div>
                          <button className="memory-delete" onClick={() => { if (confirm('取消收藏这条消息吗？')) onRemoveFavorite(fav.id) }} title="取消收藏">×</button>
                        </div>
                        <div className="favorite-preview" onClick={() => setSelectedFav(fav)}>
                          {parseMsgText(fav.content)}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* 纸条匣 */}
              <div className="settings-section">
                <div className="section-toggle" onClick={() => setNotesOpen(!notesOpen)}>
                  <span>纸条匣 💌{notes.length > 0 ? `（${notes.length} 张）` : ''}</span>
                  <span className={`toggle-arrow${notesOpen ? ' open' : ''}`}>▾</span>
                </div>
                <div className="settings-hint">他留过的每一张小纸条都收在这里，点击可以展开细看</div>

                {notesOpen && (
                  <>
                    {notes.length === 0 && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginTop: '8px' }}>还没有纸条，也许某天推开门就有了 🌙</div>
                    )}
                    {notes.map(note => (
                      <div key={note.id} className="memory-item" style={{ marginTop: '8px' }}>
                        <div className="memory-item-header">
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {!note.is_read && <span title="还未在弹窗中遇见">💌 </span>}
                            {formatNoteDate(note.created_at)}
                          </div>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            <button className="memory-delete" onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.content) }} title="编辑">✎</button>
                            <button className="memory-delete" onClick={() => { if (confirm('确定删除这张纸条吗？')) onDeleteNote(note.id) }} title="删除">×</button>
                          </div>
                        </div>
                        {renderNoteBody(note)}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {selectedNote && (
        <div className="note-detail-overlay" onClick={() => setSelectedNote(null)}>
          <div className="note-detail-card" onClick={e => e.stopPropagation()}>
            <div className="note-detail-accent"></div>
            <div className="note-detail-icon">✦</div>
            <div className="note-detail-content">{selectedNote.content}</div>
            <div className="note-detail-date">{formatNoteDate(selectedNote.created_at)}</div>
            <button className="note-detail-close" onClick={() => setSelectedNote(null)}>收好了</button>
          </div>
        </div>
      )}

      {selectedFav && (
        <div className="note-detail-overlay" onClick={() => setSelectedFav(null)}>
          <div className="note-detail-card" onClick={e => e.stopPropagation()}>
            <div className="note-detail-accent"></div>
            <div className="note-detail-icon">♡</div>
            <div className="note-detail-content">{parseMsgText(selectedFav.content)}</div>
            <div className="note-detail-date">来自「{getConvName(selectedFav.conversation_id)}」· {formatNoteDate(selectedFav.created_at)}</div>
            <button className="note-detail-close" onClick={() => setSelectedFav(null)}>收好了</button>
          </div>
        </div>
      )}
    </>
  )
}
