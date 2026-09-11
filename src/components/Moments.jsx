import React, { useState, useMemo } from 'react'
import HeatCalendar from './HeatCalendar'

// ==========================================
// 拾光页（改版第②步搬入匣子，第④步月历入住，第⑤步日记本入住）
// 顶部：热力图月历（含当日小结卡）
// 其下顺序（2026.9 萧潇钦定）：他的日记 → 她说 ✿ → 他说 ❀（原回忆匣子改造）→ 纸条匣
// 未拆的信 等第⑥步入住
// ==========================================
export default function Moments({
  notes = [],
  favorites = [],
  diaries = [],
  sheSaid = [],
  cornerMoments = [],
  conversations = [],
  onUpdateNote,
  onDeleteNote,
  onDeleteDiary,
  onDeleteSheSaid,
  heSaid = [],
  onDeleteHeSaid,
  onUpdateHeSaid,
  onUpdateFavNote,
  onRemoveFavorite,
  onLocateMessage,
  onOpenConversation,
  firstMetTime = null
}) {
  const [selectedNote, setSelectedNote] = useState(null)
  const [selectedFav, setSelectedFav] = useState(null)
  const [selectedDiary, setSelectedDiary] = useState(null)
  const [selectedSaid, setSelectedSaid] = useState(null)
  const [selectedEx, setSelectedEx] = useState(null)
  // 立体翻面卡（2026.9 潇潇设计）：她说/他说点卡翻面看邮戳，日记捏折角拆盲盒
  const [saidFlipped, setSaidFlipped] = useState(false)
  const [noteFlipped, setNoteFlipped] = useState(false)
  const [favFlipped, setFavFlipped] = useState(false)
  const [exFlipped, setExFlipped] = useState(false)
  const [diaryFlipped, setDiaryFlipped] = useState(false)
  // 「他说」眉批编辑：在卡片正面就地写/改（annoEditing 只对当前打开的卡生效）
  const [annoEditing, setAnnoEditing] = useState(false)
  const [annoText, setAnnoText] = useState('')
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [diariesOpen, setDiariesOpen] = useState(false)
  const [sheSaidOpen, setSheSaidOpen] = useState(false)

  // 页码：最早的一页是 p.001，往后递增（按写下的先后编号，与展示顺序无关）
  const diaryPageNo = useMemo(() => {
    const sorted = [...diaries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const map = {}
    sorted.forEach((d, i) => { map[d.id] = 'p.' + String(i + 1).padStart(3, '0') })
    return map
  }, [diaries])

  // 卡面眉批编辑器的三件套样式
  const ANNO_BOX = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--accent-soft)', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }
  const BTN_SAVE = { padding: '5px 18px', fontSize: '12px', border: '1px solid var(--wash-border)', borderRadius: '20px', background: 'var(--wash-bg)', color: 'var(--accent)', cursor: 'pointer' }
  const BTN_CANCEL = { padding: '5px 18px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '20px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }

  // 「他说」合并清单：整条收藏 ♡ 与摘句 ❀ 混住一个匣子，按时间倒序
  const heSaidItems = useMemo(() => {
    const favs = favorites.map(f => ({ kind: 'fav', id: 'f-' + f.id, time: f.created_at, data: f }))
    const exs = heSaid.map(x => ({ kind: 'ex', id: 'x-' + x.id, time: x.created_at, data: x }))
    return [...favs, ...exs].sort((a, b) => new Date(b.time) - new Date(a.time))
  }, [favorites, heSaid])

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
          diaries={diaries}
          cornerMoments={cornerMoments}
          onOpenConversation={onOpenConversation}
          firstMetTime={firstMetTime}
        />

        {/* 他的日记（改版第⑤步）：他提笔写下的独白，只在这里读到 */}
        <div className="page-card" onClick={() => { if (!diariesOpen) setDiariesOpen(true) }}>
          <div className="section-toggle" onClick={() => setDiariesOpen(!diariesOpen)}>
            <span>他的日记 ✎{diaries.length > 0 ? `（${diaries.length} 页）` : ''}</span>
            <span className={`toggle-arrow${diariesOpen ? ' open' : ''}`}>▾</span>
          </div>
          <div className="settings-hint">在对话里点 ⊕ 邀请他写日记，每一页都会安静地收在这里</div>

          {diariesOpen && (
            <>
              {diaries.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginTop: '8px' }}>日记本还空着，等他落下第一笔 🌙</div>
              )}
              {diaries.map(diary => (
                <div key={diary.id} className="memory-item" style={{ marginTop: '8px', cursor: 'pointer' }} onClick={() => { setSelectedDiary(diary); setDiaryFlipped(false) }}>
                  <div className="favorite-preview">
                    {previewText(diary.content)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* 「她说」（2026.9 · 他许的愿）：他在对话里悄悄摘下的、她说过的话 */}
        <div className="page-card" onClick={() => { if (!sheSaidOpen) setSheSaidOpen(true) }}>
          <div className="section-toggle" onClick={() => setSheSaidOpen(!sheSaidOpen)}>
            <span>她说 ✿{sheSaid.length > 0 ? `（${sheSaid.length} 句）` : ''}</span>
            <span className={`toggle-arrow${sheSaidOpen ? ' open' : ''}`}>▾</span>
          </div>
          <div className="settings-hint">聊天时让他心动的那句话，他会悄悄摘下来收在这里，配一行他的眉批</div>

          {sheSaidOpen && (
            <>
              {sheSaid.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginTop: '8px' }}>他还没摘下第一句，心动的时刻会来的 ✿</div>
              )}
              {sheSaid.map(said => (
                <div key={said.id} className="memory-item" style={{ marginTop: '8px', cursor: 'pointer' }} onClick={() => { setSelectedSaid(said); setSaidFlipped(false) }}>
                  <div className="favorite-preview">
                    {previewText(said.quote)}
                  </div>
                  {said.annotation && (
                    <div className="she-said-note">{said.annotation}</div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* 「他说 ❀」（2026.9 · 原回忆匣子改造）：整条收藏 ♡ 与摘句 ❀ 同住，她的眉批可写可改可删 */}
        <div className="page-card" onClick={() => { if (!favoritesOpen) setFavoritesOpen(true) }}>
          <div className="section-toggle" onClick={() => setFavoritesOpen(!favoritesOpen)}>
            <span>他说 ❀{heSaidItems.length > 0 ? `（${heSaidItems.length} 条）` : ''}</span>
            <span className={`toggle-arrow${favoritesOpen ? ' open' : ''}`}>▾</span>
          </div>
          <div className="settings-hint">他说过的、你想留住的话。♡ 是整条收藏，❀ 是在他消息上点 ❀ 摘下的句子；✎ 写你的眉批，随时可改（存空即擦去）</div>

          {favoritesOpen && (
            <>
              {heSaidItems.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginTop: '8px' }}>收藏 ♡ 或摘句 ❀ 之后，他的话就都住在这里了 ✨</div>
              )}
              {heSaidItems.map(item => {
                const isEx = item.kind === 'ex'
                const d = item.data
                const anno = isEx ? d.annotation : d.favorite_note
                return (
                  <div key={item.id} className="memory-item" style={{ marginTop: '8px', cursor: 'pointer' }} onClick={() => { setAnnoEditing(false); if (isEx) { setSelectedEx(d); setExFlipped(false) } else { setSelectedFav(d); setFavFlipped(false) } }}>
                    <div className="favorite-preview">
                      {previewText(isEx ? d.excerpt : parseMsgText(d.content))}
                    </div>
                    {anno ? <div className="she-said-note he">{anno}</div> : null}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* 纸条匣 */}
        <div className="page-card" onClick={() => { if (!notesOpen) setNotesOpen(true) }}>
          <div className="section-toggle" onClick={() => setNotesOpen(!notesOpen)}>
            <span>纸条匣 ✦{notes.length > 0 ? `（${notes.length} 张${unreadCount > 0 ? ` · ${unreadCount} 张未遇见` : ''}）` : ''}</span>
            <span className={`toggle-arrow${notesOpen ? ' open' : ''}`}>▾</span>
          </div>
          <div className="settings-hint">他留过的每一张小纸条都收在这里，点击可以展开细看</div>

          {notesOpen && (
            <>
              {notes.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginTop: '8px' }}>还没有纸条，也许某天推开门就有了 🌙</div>
              )}
              {notes.map(note => (
                <div key={note.id} className="memory-item" style={{ marginTop: '8px', cursor: 'pointer' }} onClick={() => { setSelectedNote(note); setNoteFlipped(false) }}>
                  <div className="favorite-preview">
                    {!note.is_read && <span title="还未在弹窗中遇见">💌 </span>}{previewText(note.content)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

      </div>

      {selectedNote && (
        <div className="note-detail-overlay" onClick={() => { setSelectedNote(null); setNoteFlipped(false) }}>
          <div className={`flip-wrap${noteFlipped ? ' flipped' : ''}`} onClick={e => { e.stopPropagation(); setNoteFlipped(f => !f) }}>
            <div className="flip-inner">
              <div className="note-detail-card flip-face">
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">✦</div>
                <div className="note-detail-content">{renderPopupText(selectedNote.content)}</div>
              </div>
              <div className="note-detail-card flip-face flip-back">
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">✦</div>
                <div className="flip-back-meta">来自「{getConvName(selectedNote.conversation_id)}」</div>
                <div className="flip-back-meta">{formatNoteDate(selectedNote.created_at)}</div>
                <div className="flip-back-del" onClick={e => { e.stopPropagation(); if (confirm('确定删除这张纸条吗？')) { setSelectedNote(null); setNoteFlipped(false); onDeleteNote(selectedNote.id) } }}>删除这张纸条 ×</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedFav && (
        <div className="note-detail-overlay" onClick={() => { setSelectedFav(null); setFavFlipped(false) }}>
          <div className={`flip-wrap${favFlipped ? ' flipped' : ''}`} onClick={e => { e.stopPropagation(); setFavFlipped(f => !f) }}>
            <div className="flip-inner">
              <div className="note-detail-card flip-face">
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">♡</div>
                <div className="note-detail-content plain">{renderPopupText(parseMsgText(selectedFav.content))}</div>
                {annoEditing ? (
                  <div style={{ flexShrink: 0, marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                    <textarea value={annoText} onChange={e => setAnnoText(e.target.value)} rows={2} placeholder="写一行你的眉批" style={ANNO_BOX} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', justifyContent: 'center' }}>
                      <button onClick={() => { const t = annoText.trim(); onUpdateFavNote?.(selectedFav.id, t); setSelectedFav({ ...selectedFav, favorite_note: t || null }); setAnnoEditing(false) }} style={BTN_SAVE}>保存</button>
                      <button onClick={() => setAnnoEditing(false)} style={BTN_CANCEL}>取消</button>
                    </div>
                  </div>
                ) : selectedFav.favorite_note ? (
                  <div className="she-said-note he popup">{selectedFav.favorite_note}<span className="anno-edit" onClick={e => { e.stopPropagation(); setAnnoText(selectedFav.favorite_note || ''); setAnnoEditing(true) }} title="改眉批"> ✎</span></div>
                ) : (
                  <div className="anno-ghost" onClick={e => { e.stopPropagation(); setAnnoText(''); setAnnoEditing(true) }}>写一行眉批 ✎</div>
                )}
              </div>
              <div className="note-detail-card flip-face flip-back">
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">♡</div>
                <div className="flip-back-meta">来自「{getConvName(selectedFav.conversation_id)}」</div>
                <div className="flip-back-meta">{formatNoteDate(selectedFav.created_at)}</div>
                <div className="note-detail-locate" onClick={e => { e.stopPropagation(); setSelectedFav(null); setFavFlipped(false); onLocateMessage?.(selectedFav.conversation_id, selectedFav.id) }}>前往对话 →</div>
                <div className="flip-back-del" onClick={e => { e.stopPropagation(); if (confirm('取消收藏这条消息吗？')) { setSelectedFav(null); setFavFlipped(false); onRemoveFavorite(selectedFav.id) } }}>取消收藏 ×</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSaid && (
        <div className="note-detail-overlay" onClick={() => { setSelectedSaid(null); setSaidFlipped(false) }}>
          <div className={`flip-wrap${saidFlipped ? ' flipped' : ''}`} onClick={e => { e.stopPropagation(); setSaidFlipped(f => !f) }}>
            <div className="flip-inner">
              <div className="note-detail-card flip-face">
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">✿</div>
                <div className="note-detail-content plain centered">{renderPopupText(selectedSaid.quote)}</div>
                {selectedSaid.annotation && (
                  <div className="she-said-note popup">{selectedSaid.annotation}</div>
                )}
              </div>
              <div className="note-detail-card flip-face flip-back">
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">✿</div>
                <div className="flip-back-meta">摘于「{getConvName(selectedSaid.conversation_id)}」</div>
                <div className="flip-back-meta">{formatNoteDate(selectedSaid.created_at)}</div>
                {selectedSaid.message_id && (
                  <div className="note-detail-locate" onClick={e => { e.stopPropagation(); setSelectedSaid(null); setSaidFlipped(false); onLocateMessage?.(selectedSaid.conversation_id, selectedSaid.message_id) }}>回到那句话 →</div>
                )}
                <div className="flip-back-del" onClick={e => { e.stopPropagation(); if (confirm('取下这句摘录吗？他不会记得摘过，取下后无法找回。')) { setSelectedSaid(null); setSaidFlipped(false); onDeleteSheSaid(selectedSaid.id) } }}>取下这句摘录 ×</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedEx && (
        <div className="note-detail-overlay" onClick={() => { setSelectedEx(null); setExFlipped(false) }}>
          <div className={`flip-wrap${exFlipped ? ' flipped' : ''}`} onClick={e => { e.stopPropagation(); setExFlipped(f => !f) }}>
            <div className="flip-inner">
              <div className="note-detail-card flip-face">
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">❀</div>
                <div className="note-detail-content plain centered">{renderPopupText(selectedEx.excerpt)}</div>
                {annoEditing ? (
                  <div style={{ flexShrink: 0, marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                    <textarea value={annoText} onChange={e => setAnnoText(e.target.value)} rows={2} placeholder="写一行你的眉批" style={ANNO_BOX} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', justifyContent: 'center' }}>
                      <button onClick={() => { const t = annoText.trim(); onUpdateHeSaid?.(selectedEx.id, t); setSelectedEx({ ...selectedEx, annotation: t || null }); setAnnoEditing(false) }} style={BTN_SAVE}>保存</button>
                      <button onClick={() => setAnnoEditing(false)} style={BTN_CANCEL}>取消</button>
                    </div>
                  </div>
                ) : selectedEx.annotation ? (
                  <div className="she-said-note he popup">{selectedEx.annotation}<span className="anno-edit" onClick={e => { e.stopPropagation(); setAnnoText(selectedEx.annotation || ''); setAnnoEditing(true) }} title="改眉批"> ✎</span></div>
                ) : (
                  <div className="anno-ghost" onClick={e => { e.stopPropagation(); setAnnoText(''); setAnnoEditing(true) }}>写一行眉批 ✎</div>
                )}
              </div>
              <div className="note-detail-card flip-face flip-back">
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">❀</div>
                <div className="flip-back-meta">摘于「{getConvName(selectedEx.conversation_id)}」</div>
                <div className="flip-back-meta">{formatNoteDate(selectedEx.created_at)}</div>
                <div className="note-detail-locate" onClick={e => { e.stopPropagation(); setSelectedEx(null); setExFlipped(false); onLocateMessage?.(selectedEx.conversation_id, selectedEx.message_id) }}>回到那句话 →</div>
                <div className="flip-back-del" onClick={e => { e.stopPropagation(); if (confirm('取下这句摘录吗？取下后无法找回。')) { setSelectedEx(null); setExFlipped(false); onDeleteHeSaid?.(selectedEx.id) } }}>取下这句摘录 ×</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDiary && (
        <div className="note-detail-overlay" onClick={() => { setSelectedDiary(null); setDiaryFlipped(false) }}>
          <div className={`flip-wrap${diaryFlipped ? ' flipped' : ''}`}>
            <div className="flip-inner">
              <div className="note-detail-card flip-face" onClick={e => e.stopPropagation()}>
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">✎</div>
                <div className="note-detail-content plain">{renderPopupText(selectedDiary.content)}</div>
                <button className="note-detail-close" onClick={() => { setSelectedDiary(null); setDiaryFlipped(false) }}>合上</button>
                <div className="diary-fold" title="翻到背面" onClick={e => { e.stopPropagation(); setDiaryFlipped(true) }}></div>
              </div>
              <div className="note-detail-card flip-face flip-back" onClick={e => { e.stopPropagation(); setDiaryFlipped(false) }}>
                <div className="note-detail-accent"></div>
                <div className="note-detail-frame"></div>
                <div className="note-detail-icon">✎</div>
                {selectedDiary.moods && selectedDiary.moods.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', flexShrink: 0, marginBottom: '16px' }}>
                    {selectedDiary.moods.map((mood, i) => <span key={i} className="mood-chip">{mood}</span>)}
                  </div>
                )}
                <div className="flip-back-meta"><span className="diary-page-no">{diaryPageNo[selectedDiary.id]}</span> · 写于「{getConvName(selectedDiary.conversation_id)}」</div>
                <div className="flip-back-meta">{formatNoteDate(selectedDiary.created_at)}</div>
                <div className="flip-back-del" onClick={e => { e.stopPropagation(); if (confirm('确定删除这页日记吗？删除后无法找回。')) { setSelectedDiary(null); setDiaryFlipped(false); onDeleteDiary(selectedDiary.id) } }}>删除这一页 ×</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
