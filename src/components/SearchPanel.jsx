import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// 解析消息内容（图片消息只取文字部分）
function parseText(content) {
  if (!content) return ''
  try {
    const parsed = JSON.parse(content)
    if (parsed.images) return parsed.text || ''
  } catch (e) {}
  return content
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function SearchPanel({ activeConvId, activeConvName, onClose, onOpenResult }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState(activeConvId ? 'current' : 'all')
  const [msgResults, setMsgResults] = useState([])
  const [convResults, setConvResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // 输入停顿 400ms 后自动搜索
  useEffect(() => {
    const q = query.trim()
    if (!q) { setMsgResults([]); setConvResults([]); setSearched(false); return }

    const timer = setTimeout(async () => {
      setSearching(true)
      const pattern = '%' + q.replace(/[%_]/g, m => '\\' + m) + '%'

      let msgQuery = supabase
        .from('messages')
        .select('id, conversation_id, content, created_at, role, conversations(name)')
        .ilike('content', pattern)
        .order('created_at', { ascending: false })
        .limit(30)
      if (scope === 'current' && activeConvId) msgQuery = msgQuery.eq('conversation_id', activeConvId)

      const { data: msgs } = await msgQuery
      // 图片消息的编码数据可能误中英文关键词，解析出纯文字后再核对一遍
      const filtered = (msgs || []).filter(m => parseText(m.content).toLowerCase().includes(q.toLowerCase()))
      setMsgResults(filtered)

      if (scope === 'all') {
        const { data: convs } = await supabase.from('conversations').select('id, name').ilike('name', pattern).limit(10)
        setConvResults(convs || [])
      } else {
        setConvResults([])
      }

      setSearching(false)
      setSearched(true)
    }, 400)

    return () => clearTimeout(timer)
  }, [query, scope, activeConvId])

  // 生成带黄色高亮的摘要片段
  const renderSnippet = (content, q) => {
    const text = parseText(content).replace(/\n+/g, ' ')
    const lower = text.toLowerCase()
    const idx = lower.indexOf(q.toLowerCase())
    if (idx < 0) return text.slice(0, 60)

    const start = Math.max(0, idx - 20)
    const end = Math.min(text.length, idx + q.length + 40)
    const snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')

    const parts = snippet.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase()
        ? <span key={i} style={{ background: '#FBE79E', color: '#5C4A3A', borderRadius: '3px', padding: '0 1px' }}>{part}</span>
        : <React.Fragment key={i}>{part}</React.Fragment>
    )
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  const scopeBtnStyle = (active) => ({
    padding: '4px 14px',
    fontSize: '13px',
    border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
    borderRadius: '14px',
    background: active ? 'var(--accent-soft)' : 'var(--bg-primary)',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    cursor: 'pointer'
  })

  const resultItemStyle = {
    padding: '10px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    border: '1px solid transparent'
  }

  const q = query.trim()
  const hasResults = msgResults.length > 0 || convResults.length > 0

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="settings-header">
          <span className="settings-title">搜索</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden', flex: 1 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="输入关键词…"
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            {activeConvId && (
              <button style={scopeBtnStyle(scope === 'current')} onClick={() => setScope('current')}>当前对话</button>
            )}
            <button style={scopeBtnStyle(scope === 'all')} onClick={() => setScope('all')}>全部对话</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {!q && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '30px 0' }}>
                输入关键词开始搜索{scope === 'current' && activeConvName ? `「${activeConvName}」` : ''}
              </div>
            )}

            {q && searching && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '30px 0' }}>搜索中…</div>
            )}

            {q && !searching && searched && !hasResults && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '30px 0' }}>没有找到「{q}」</div>
            )}

            {convResults.length > 0 && (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 4px 0' }}>对话标题</div>
                {convResults.map(c => (
                  <div key={c.id} style={resultItemStyle}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => onOpenResult(c.id, null)}>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>💬 {c.name}</div>
                  </div>
                ))}
              </>
            )}

            {msgResults.length > 0 && (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 4px 0' }}>消息内容</div>
                {msgResults.map(m => (
                  <div key={m.id} style={resultItemStyle}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => onOpenResult(m.conversation_id, m.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {m.conversations?.name || '对话'} · {m.role === 'user' ? '你' : 'TA'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{formatTime(m.created_at)}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5', wordBreak: 'break-all' }}>
                      {renderSnippet(m.content, q)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
