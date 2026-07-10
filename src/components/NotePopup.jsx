import React from 'react'

export default function NotePopup({ note, onDismiss }) {
  if (!note) return null

  return (
    <div className="note-overlay" onClick={onDismiss}>
      <div className="note-card" onClick={e => e.stopPropagation()}>
        <div className="note-emoji">📝</div>
        <div className="note-label">他给你留了一张小纸条</div>
        <div className="note-content" style={{ whiteSpace: 'pre-wrap' }}>「{note.content}」</div>
        <button className="note-dismiss" onClick={onDismiss}>
          我看到了
        </button>
      </div>
    </div>
  )
}
