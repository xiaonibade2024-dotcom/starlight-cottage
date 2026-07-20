import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// ==========================================
// 一隅（改版第⑦步 · 第一批）：他的生活动态页
// 院规四条：门由她推（推门按钮常驻，灯只是信号）／一座院认一扇窗（绑定可换、换绑不丢家当）／
//           留言是慢的（悄悄话在下次推门时才被他看见）／世界由人设长出（地点由他自己标）
// 灯的判定纯本地掷骰子、零成本，每院每日至多一次；
// 先记日期再掷（"推门先开口"存档里的教训：防刷新反复掷骰子）
// ==========================================

const LAMP_KEY = 'starlight_lamp'
const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const shichenOf = (d) => SHICHEN[Math.floor(((d.getHours() + 1) % 24) / 2)] + '时'
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const isToday = (dateStr) => {
  const d = new Date(dateStr); const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

// 院子设置小图标（钢笔画线条家族：viewBox 24 / stroke currentColor / 1.6 圆头圆角）
const GearIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
    <path d="M4.5 8.3h9" /><circle cx="17" cy="8.3" r="2.3" />
    <path d="M19.5 15.7h-9" /><circle cx="7" cy="15.7" r="2.3" />
  </svg>
)

export default function Corner({
  courtyards = [],
  moments = [],
  comments = [],
  conversations = [],
  momentWriting = null,
  onCreate,
  onRename,
  onRebind,
  onUpdateQuiet,
  onDeleteYard,
  onPushDoor,
  onToggleLike,
  onAddComment,
  onDeleteMoment
}) {
  const [activeYardId, setActiveYardId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newYardConv, setNewYardConv] = useState('')
  const [newYardName, setNewYardName] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editQuiet, setEditQuiet] = useState('')
  const [commentFor, setCommentFor] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [lampLit, setLampLit] = useState(false)

  // 默认停在第一座院；院子拆除后自动挪窝
  useEffect(() => {
    if (courtyards.length === 0) { setActiveYardId(null); return }
    if (!activeYardId || !courtyards.some(c => c.id === activeYardId)) setActiveYardId(courtyards[0].id)
  }, [courtyards]) // eslint-disable-line react-hooks/exhaustive-deps

  const yard = courtyards.find(c => c.id === activeYardId) || null
  const yardMoments = useMemo(() => moments.filter(m => m.courtyard_id === activeYardId), [moments, activeYardId])
  const commentsByMoment = useMemo(() => {
    const map = {}
    for (const c of comments) {
      if (!map[c.moment_id]) map[c.moment_id] = []
      map[c.moment_id].push(c)
    }
    return map
  }, [comments])

  // 灯：每院每日至多掷一次骰子。隔上次动静越久越容易亮；
  // 绑定的窗在那之后又聊了不少（≥10条）再添一分——聊得热闹的院子动静多。
  useEffect(() => {
    let alive = true
    setLampLit(false)
    if (!yard) return
    const judge = async () => {
      let store = {}
      try { store = JSON.parse(localStorage.getItem(LAMP_KEY) || '{}') } catch (e) {}
      const today = todayStr()
      const rec = store[yard.id]
      if (rec && rec.date === today) { if (alive) setLampLit(!!rec.lit); return }
      // 先记日期再掷（刷新中途也不会重掷）
      store[yard.id] = { date: today, lit: false }
      try { localStorage.setItem(LAMP_KEY, JSON.stringify(store)) } catch (e) {}
      const lastMoment = moments
        .filter(m => m.courtyard_id === yard.id && m.author === 'him')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      const baseTime = lastMoment ? new Date(lastMoment.created_at) : new Date(yard.created_at)
      const hours = (Date.now() - baseTime.getTime()) / 3600000
      let p = hours >= 48 ? 0.8 : hours >= 24 ? 0.55 : hours >= 12 ? 0.3 : 0
      if (p > 0 && yard.conversation_id) {
        try {
          const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', yard.conversation_id).gte('created_at', baseTime.toISOString())
          if ((count || 0) >= 10) p += 0.15
        } catch (e) {}
      }
      const lit = Math.random() < Math.min(0.9, p)
      store[yard.id] = { date: today, lit }
      try { localStorage.setItem(LAMP_KEY, JSON.stringify(store)) } catch (e) {}
      if (alive) setLampLit(lit)
    }
    judge()
    return () => { alive = false }
  }, [activeYardId, courtyards]) // eslint-disable-line react-hooks/exhaustive-deps

  // 今天推过门、院里已有了新动静，灯就自己熄了（信号完成了它的使命）
  const latestHim = yardMoments.find(m => m.author === 'him') || null
  useEffect(() => {
    if (!yard || !latestHim || !isToday(latestHim.created_at)) return
    setLampLit(false)
    try {
      const store = JSON.parse(localStorage.getItem(LAMP_KEY) || '{}')
      store[yard.id] = { date: todayStr(), lit: false }
      localStorage.setItem(LAMP_KEY, JSON.stringify(store))
    } catch (e) {}
  }, [latestHim?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const getConvName = (convId) => conversations.find(c => c.id === convId)?.name || '不在的窗'
  const fmtMomentTime = (dateStr) => {
    const d = new Date(dateStr)
    const yearPart = d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}年` : ''
    return `${yearPart}${d.getMonth() + 1}月${d.getDate()}日 · ${shichenOf(d)}`
  }

  const startCreate = () => {
    setCreating(true)
    setSettingsOpen(false)
    setNewYardConv(conversations[0]?.id || '')
    setNewYardName('')
  }

  const submitCreate = async () => {
    if (!newYardConv) return
    const name = newYardName.trim() || getConvName(newYardConv)
    const made = await onCreate?.(name, newYardConv)
    if (made) { setCreating(false); setActiveYardId(made.id) }
  }

  const openSettings = () => {
    if (!yard) return
    setCreating(false)
    setSettingsOpen(!settingsOpen)
    setEditName(yard.name)
    setEditQuiet(yard.quiet_text || '')
  }

  const submitComment = async (momentId) => {
    const text = commentText.trim()
    if (!text) return
    await onAddComment?.(momentId, text)
    setCommentText('')
    setCommentFor(null)
  }

  const writingHere = yard && momentWriting === yard.id

  return (
    <div className="page page-corner">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-title">一隅</div>
          <div className="page-caption">A QUIET CORNER</div>
        </div>

        {/* 院子切换签 + 开院 */}
        <div className="yard-tabs">
          {courtyards.map(c => (
            <button key={c.id} className={`capsule ${c.id === activeYardId ? 'on' : ''}`} onClick={() => { setActiveYardId(c.id); setSettingsOpen(false); setCreating(false); setCommentFor(null) }}>{c.name}</button>
          ))}
          <button className="capsule" onClick={startCreate}>＋ 开一座院</button>
        </div>

        {/* 开院表单 */}
        {creating && (
          <div className="page-card">
            {conversations.length === 0 ? (
              <div className="settings-hint">还没有对话窗口——先去和他说说话，再回来为那条故事线开一座院子吧 🌙</div>
            ) : (
              <>
                <div className="settings-label">这座院认哪扇窗</div>
                <select className="settings-input corner-select" value={newYardConv} onChange={e => setNewYardConv(e.target.value)}>
                  {conversations.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="settings-label" style={{ marginTop: '14px' }}>院名</div>
                <input className="settings-input corner-input" value={newYardName} onChange={e => setNewYardName(e.target.value)} placeholder={getConvName(newYardConv) || '给院子起个名字'} />
                <div className="settings-hint">生成动静时喂给他的，是这扇窗的最近对话与全部记忆；以后随时可以换绑，旧动静一条不丢</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                  <button className="settings-save" style={{ marginTop: 0, flex: 1 }} onClick={submitCreate} disabled={!newYardConv}>落成</button>
                  <button className="capsule" onClick={() => setCreating(false)}>先不了</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 一座院都还没有：安静的空状态 */}
        {courtyards.length === 0 && !creating && (
          <div className="empty-state" style={{ minHeight: '48vh' }}>
            <div className="empty-state-icon">🌙</div>
            <div className="empty-state-text">院落还空着<br />为一条故事线开一座院子，他生活里的动静会住进这里</div>
          </div>
        )}

        {yard && (
          <>
            {/* 院子门楣：院名 + 认着的窗 + 设置 */}
            <div className="yard-head">
              <div style={{ minWidth: 0 }}>
                <div className="yard-name">{yard.name}</div>
                <div className="yard-bound">这座院认着「{getConvName(yard.conversation_id)}」的窗</div>
              </div>
              <button className="yard-gear" onClick={openSettings} title="院子设置">{GearIcon}</button>
            </div>

            {/* 院子设置：改名 / 换绑 / 安静状态语 / 拆除 */}
            {settingsOpen && (
              <div className="page-card">
                <div className="settings-label">院名</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="settings-input corner-input" value={editName} onChange={e => setEditName(e.target.value)} />
                  <button className="capsule" onClick={() => { if (editName.trim()) onRename?.(yard.id, editName.trim()) }}>改名</button>
                </div>
                <div className="settings-label" style={{ marginTop: '14px' }}>认哪扇窗（换绑不丢旧动静）</div>
                <select className="settings-input corner-select" value={conversations.some(c => c.id === yard.conversation_id) ? yard.conversation_id : ''} onChange={e => { if (e.target.value) onRebind?.(yard.id, e.target.value) }}>
                  {!conversations.some(c => c.id === yard.conversation_id) && <option value="">（原来的窗已不在，请选一扇新的）</option>}
                  {conversations.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="settings-label" style={{ marginTop: '14px' }}>安静状态语（院里无事时的一句话）</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="settings-input corner-input" value={editQuiet} onChange={e => setEditQuiet(e.target.value)} placeholder="院中无事" />
                  <button className="capsule" onClick={() => onUpdateQuiet?.(yard.id, editQuiet)}>保存</button>
                </div>
                <button className="corner-demolish" onClick={() => { if (confirm(`拆除「${yard.name}」吗？院里的动静和悄悄话都会一并散去，无法找回。`)) { setSettingsOpen(false); onDeleteYard?.(yard.id) } }}>拆除这座院子</button>
              </div>
            )}

            {/* 灯：只是信号，不是门闩——亮不亮，门都推得开 */}
            {lampLit && !writingHere && <div className="lamp-card">院里似乎有新的动静</div>}

            {/* 推门看看：常驻按钮，一隅唯一花钱的动作 */}
            <button className={`push-door${writingHere ? ' writing' : ''}`} disabled={!!momentWriting} onClick={() => onPushDoor?.(yard.id)}>
              {writingHere ? '他正在院里写着什么…' : '推门看看'}
            </button>

            {/* 动静时间流（最新在上） */}
            {yardMoments.length === 0 && !writingHere && (
              <div className="corner-quiet">{yard.quiet_text || '院中无事'}</div>
            )}
            {yardMoments.map(m => {
              const mComments = commentsByMoment[m.id] || []
              return (
                <div key={m.id} className="moment-card">
                  <div className="moment-meta">
                    {m.location && <span className="loc-chip">{m.location}</span>}
                    <span>{fmtMomentTime(m.created_at)}</span>
                  </div>
                  <div className="moment-content">{m.content}</div>
                  <div className="moment-actions">
                    <button className={`moment-like${m.liked ? ' on' : ''}`} onClick={() => onToggleLike?.(m.id)}>{m.liked ? '♥' : '♡'} 收进心里</button>
                    <button className="moment-act" onClick={() => { setCommentFor(commentFor === m.id ? null : m.id); setCommentText('') }}>说句悄悄话</button>
                    <button className="moment-act danger" onClick={() => { if (confirm('抹去这条动静吗？它底下的悄悄话也会一并散去。')) onDeleteMoment?.(m.id) }} title="删除">×</button>
                  </div>
                  {mComments.length > 0 && (
                    <div className="corner-comments">
                      {mComments.map(c => (
                        <div key={c.id} className={`corner-comment${c.author === 'him' ? ' him' : ''}`}>
                          <span className="corner-comment-who">{c.author === 'him' ? '他' : '我'}</span>
                          <span className="corner-comment-text">{c.content}</span>
                          {c.author === 'her' && !c.seen && <span className="corner-wait">等他看见</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {commentFor === m.id && (
                    <div className="comment-input-row">
                      <input className="comment-input" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="想对这条动静说点什么…" onKeyDown={e => { if (e.key === 'Enter') submitComment(m.id) }} />
                      <button className="comment-send" onClick={() => submitComment(m.id)}>留下</button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
