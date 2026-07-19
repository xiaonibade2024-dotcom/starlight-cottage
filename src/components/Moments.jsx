import React, { useState } from 'react'
import HeatCalendar from './HeatCalendar'

// ==========================================
// 拾光页（改版第②步搬入匣子，第④步月历入住）
// 顶部：热力图月历（含当日小结卡）
// 其下：纸条匣在上、回忆匣子在下（萧潇钦定），功能一根汗毛不动
// 日记/信 等第⑤⑥步入住
// ==========================================
export default function Moments({
  notes = [],
  favorites = [],
  conversations = [],
  onUpdateNote,
  onDeleteNote,
  onRemoveFavorite,
  onLocateMessage,
  onOpenConversation,
  firstMetTime = null
}) {
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')
  const [selectedNote, setSelectedNote] = useState(null)
  const [selectedFav, setSelectedFav] = useState(null)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

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

  // 列表预览：把空行收拢成单换行，让有限的预览高度装下更多内容
  const previewText = (text) => String(text || '').replace(/\n{2,}/g, '\n')

  // 弹窗正文：按空行拆成段落，段距由 CSS 优雅控制（只改显示，原文不动）
  const renderPopupText = (text) => {
    return String(text || '').split(/\n{2,}/).map((para, i) => (
      <p key={i} className="note-detail-para">{para}</p>
    ))
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
          <button onClick={saveNoteEdit} style={{ padding: '5px 18px', fontSize: '12px', border: '1px solid var(--wash-border)', borderRadius: '20px', background: 'var(--wash-bg)', color: 'var(--accent)', cursor: 'pointer' }}>保存</button>
          <button onClick={() => { setEditingNoteId(null); setEditNoteText('') }} style={{ padding: '5px 18px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '20px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
        </div>
      </div>
    )
  }

  const unreadCount = notes.filter(n => !n.is_read).length

  return (
    <div className="page page-moments">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-title">拾光</div>
          <div className="page-caption">MOMENTS KEPT</div>
        </div>

        {/* 热力图月历（改版第④步）：每一天的深浅，是你们说过的话 */}
        <HeatCalendar
          conversations={conversations}
          notes={notes}
          onOpenConversation={onOpenConversation}
          firstMetTime={firstMetTime}
        />

        {/* 纸条匣 */}
        <div className="page-card">
          <div className="section-toggle" onClick={() => setNotesOpen(!notesOpen)}>
            <span>纸条匣 💌{notes.length > 0 ? `（${notes.length} 张${unreadCount > 0 ? ` · ${unreadCount} 张未遇见` : ''}）` : ''}</span>
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
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px' }}>
                      {!note.is_read && <span title="还未在弹窗中遇见">💌 </span>}
                      {getConvName(note.conversation_id)} · {formatShortDate(note.created_at)}
                    </div>
                    <div className="memory-actions">
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

        {/* 回忆匣子 */}
        <div className="page-card">
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
                    {previewText(parseMsgText(fav.content))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {selectedNote && (
        <div className="note-detail-overlay" onClick={() => setSelectedNote(null)}>
          <div className="note-detail-card" onClick={e => e.stopPropagation()}>
            <div className="note-detail-accent"></div>
            <div className="note-detail-frame"></div>
            <div className="note-detail-icon">✦</div>
            <div className="note-detail-content">{renderPopupText(selectedNote.content)}</div>
            <div className="note-detail-date">来自「{getConvName(selectedNote.conversation_id)}」· {formatNoteDate(selectedNote.created_at)}</div>
            <button className="note-detail-close" onClick={() => setSelectedNote(null)}>收好了</button>
          </div>
        </div>
      )}

      {selectedFav && (
        <div className="note-detail-overlay" onClick={() => setSelectedFav(null)}>
          <div className="note-detail-card" onClick={e => e.stopPropagation()}>
            <div className="note-detail-accent"></div>
            <div className="note-detail-frame"></div>
            <div className="note-detail-icon">♡</div>
            <div className="note-detail-content plain">{renderPopupText(parseMsgText(selectedFav.content))}</div>
            <div className="note-detail-date">来自「{getConvName(selectedFav.conversation_id)}」· {formatNoteDate(selectedFav.created_at)}</div>
            <button className="note-detail-close" onClick={() => setSelectedFav(null)}>收好了</button>
            <div className="note-detail-locate" onClick={() => { setSelectedFav(null); onLocateMessage?.(selectedFav.conversation_id, selectedFav.id) }}>前往对话 →</div>
          </div>
        </div>
      )}
    </div>
  )
}
