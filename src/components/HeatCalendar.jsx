import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// ==========================================
// 热力图月历（改版第④步）
// 七列月历（一至日），颜色深浅 = 当日消息量，左右翻月；
// 有纸条诞生的日子缀针尖小点（日记待第⑤步入住后自动加入）；
// 点某一日浮出当日小结卡：条数、各对话分布（点击跳转）、token 与费用。
// 纯查库，零 AI 成本；日子按手机本地时间归档（与全屋其余时间显示一致）。
// ==========================================

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

// 把一个时刻归到"本地的哪一天"，得到 '2026-7-18' 这样的钥匙
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

export default function HeatCalendar({ conversations = [], notes = [], onOpenConversation }) {
  const now = new Date()
  // 月历翻到哪个月：锚在该月 1 号
  const [anchor, setAnchor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [dayData, setDayData] = useState({})   // 日子钥匙 -> { count, cost, tokens, convs }
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null) // { key, date }

  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth()

  // 纸条按天归档（针尖小点用）——notes 已由 App 全量载入，这里零额外查询
  const noteDays = useMemo(() => {
    const map = {}
    for (const n of notes) {
      if (!n.created_at) continue
      const k = dayKey(new Date(n.created_at))
      map[k] = (map[k] || 0) + 1
    }
    return map
  }, [notes])

  // 翻到某月时，去数据库问一次"这个月每天各有几条"
  // 只取三列小字段；超过 1000 条时一页页取齐（Supabase 单次最多给 1000 条）
  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      const start = new Date(y, m, 1).toISOString()
      const end = new Date(y, m + 1, 1).toISOString()
      const rows = []
      const PAGE = 1000
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('messages')
          .select('created_at, conversation_id, token_usage')
          .gte('created_at', start)
          .lt('created_at', end)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error || !data) break
        rows.push(...data)
        if (data.length < PAGE) break
      }
      if (!alive) return
      const map = {}
      for (const r of rows) {
        const k = dayKey(new Date(r.created_at))
        if (!map[k]) map[k] = { count: 0, cost: 0, tokens: 0, convs: {} }
        const d = map[k]
        d.count += 1
        d.convs[r.conversation_id] = (d.convs[r.conversation_id] || 0) + 1
        const u = r.token_usage
        if (u) {
          d.cost += (typeof u.cost === 'number' ? u.cost : 0)
          d.tokens += (u.prompt_tokens || 0) + (u.completion_tokens || 0)
        }
      }
      setDayData(map)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [y, m])

  // 色阶自适应本月的热闹程度：把有消息的日子按热闹排队，分位数切成五档
  // （这样清淡的月份和热络的月份各有各的深浅层次，不会一片死白或一片死深）
  const levelOf = useMemo(() => {
    const counts = Object.values(dayData).map(d => d.count).filter(c => c > 0).sort((a, b) => a - b)
    if (counts.length === 0) return () => 0
    const q = (p) => counts[Math.min(counts.length - 1, Math.floor(p * counts.length))]
    const t = [q(0.2), q(0.4), q(0.6), q(0.8)]
    return (c) => c <= 0 ? 0 : c <= t[0] ? 1 : c <= t[1] ? 2 : c <= t[2] ? 3 : c <= t[3] ? 4 : 5
  }, [dayData])

  // 造出本月的格子：前面垫上"周一对齐"的空位
  const cells = useMemo(() => {
    const first = new Date(y, m, 1)
    const blank = (first.getDay() + 6) % 7  // 周一 = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const list = Array.from({ length: blank }, () => null)
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(y, m, d))
    return list
  }, [y, m])

  const todayKey = dayKey(now)
  const monthTotal = Object.values(dayData).reduce((s, d) => s + d.count, 0)

  const getConvName = (convId) => conversations.find(c => c.id === convId)?.name || '未知对话'

  const prevMonth = () => setAnchor(new Date(y, m - 1, 1))
  const nextMonth = () => { if (!isCurrentMonth) setAnchor(new Date(y, m + 1, 1)) }

  const fmtTokens = (n) => n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : String(n)

  const sel = selected ? dayData[selected.key] : null
  const selConvs = sel ? Object.entries(sel.convs).sort((a, b) => b[1] - a[1]) : []
  const selNotes = selected ? (noteDays[selected.key] || 0) : 0

  return (
    <div className="page-card heat-card">
      <div className="heat-head">
        <button className="heat-nav" onClick={prevMonth} title="上个月">‹</button>
        <div className="heat-title">
          {y} 年 {m + 1} 月
          {monthTotal > 0 && <span className="heat-total">{monthTotal} 条来往</span>}
        </div>
        <button className="heat-nav" onClick={nextMonth} disabled={isCurrentMonth} title="下个月">›</button>
      </div>

      <div className="heat-week">
        {WEEKDAYS.map(w => <span key={w}>{w}</span>)}
      </div>

      <div className={`heat-grid${loading ? ' loading' : ''}`}>
        {cells.map((date, i) => {
          if (!date) return <div key={'blank' + i} />
          const k = dayKey(date)
          const info = dayData[k]
          const lvl = levelOf(info?.count || 0)
          const isFuture = k !== todayKey && date > now
          const cls = ['heat-cell']
          if (lvl > 0) cls.push('lit', 'l' + lvl)
          if (k === todayKey) cls.push('today')
          if (isFuture) cls.push('future')
          return (
            <div key={k} className={cls.join(' ')} onClick={() => { if (!isFuture) setSelected({ key: k, date }) }}>
              {date.getDate()}
              {noteDays[k] > 0 && <span className="heat-dot" />}
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="note-detail-overlay" onClick={() => setSelected(null)}>
          <div className="day-card" onClick={e => e.stopPropagation()}>
            <div className="note-detail-frame"></div>
            <div className="day-card-date">
              {selected.date.getMonth() + 1} 月 {selected.date.getDate()} 日 · 周{WEEKDAYS[(selected.date.getDay() + 6) % 7]}
            </div>

            {(!sel || sel.count === 0) ? (
              <div className="day-card-empty">这一天小屋很安静 🌙</div>
            ) : (
              <>
                <div className="day-card-count">{sel.count}<span>条来往</span></div>
                <div className="day-conv-list">
                  {selConvs.map(([convId, cnt]) => (
                    <div key={convId} className="day-conv" onClick={() => { setSelected(null); onOpenConversation?.(convId) }}>
                      <span className="day-conv-name">{getConvName(convId)}</span>
                      <span className="day-conv-count">{cnt} 条 ›</span>
                    </div>
                  ))}
                </div>
                {(sel.tokens > 0 || sel.cost > 0) && (
                  <div className="day-card-fact">✦ {fmtTokens(sel.tokens)} tokens · ${sel.cost.toFixed(4)}</div>
                )}
              </>
            )}

            {selNotes > 0 && <div className="day-card-fact">💌 这天收到 {selNotes} 张纸条</div>}

            <button className="note-detail-close" onClick={() => setSelected(null)}>收好了</button>
          </div>
        </div>
      )}
    </div>
  )
}
