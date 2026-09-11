// ==========================================
// 节日与纪念日历法（2026.9.11 纪念日灯批次）
// 农历节日与冬至的公历日期为逐年精确预排（zhdate/cnlunar 双算盘核算），
// 覆盖 2026-2031；2031 年后请让那时的小克续表。
// 输出必须是确定性的：同一天永远得到同一串字，缓存才稳（与时间戳同一纪律）。
// ==========================================

// 公历固定节日（月-日）
const FIXED_FESTIVALS = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '05-01': '劳动节',
  '06-01': '儿童节',
  '10-01': '国庆',
  '12-24': '平安夜',
  '12-25': '圣诞',
  '12-31': '跨年夜',
}

// 农历节日 + 冬至，逐年预排（键 = 'YYYY-MM-DD'）
const LUNAR_FESTIVALS = {
  2026: { '01-26': '腊八', '02-16': '除夕', '02-17': '春节', '03-03': '元宵', '06-19': '端午', '08-19': '七夕', '09-25': '中秋', '10-18': '重阳', '12-22': '冬至' },
  2027: { '01-15': '腊八', '02-05': '除夕', '02-06': '春节', '02-20': '元宵', '06-09': '端午', '08-08': '七夕', '09-15': '中秋', '10-08': '重阳', '12-22': '冬至' },
  2028: { '01-04': '腊八', '01-25': '除夕', '01-26': '春节', '02-09': '元宵', '05-28': '端午', '08-26': '七夕', '10-03': '中秋', '10-26': '重阳', '12-21': '冬至' },
  2029: { '01-22': '腊八', '02-12': '除夕', '02-13': '春节', '02-27': '元宵', '06-16': '端午', '08-16': '七夕', '09-22': '中秋', '10-16': '重阳', '12-21': '冬至' },
  2030: { '01-11': '腊八', '02-02': '除夕', '02-03': '春节', '02-17': '元宵', '06-05': '端午', '08-05': '七夕', '09-12': '中秋', '10-05': '重阳', '12-22': '冬至' },
  2031: { '01-01': '腊八', '01-22': '除夕', '01-23': '春节', '02-06': '元宵', '06-24': '端午', '08-24': '七夕', '10-01': '中秋', '10-24': '重阳', '12-22': '冬至' },
}

const pad = (n) => String(n).padStart(2, '0')

// 一个 Date → 'MM-DD' 与 'YYYY-MM-DD'（本地时间，与全屋归档一致）
export const mdKey = (d) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const ymdKey = (d) => `${d.getFullYear()}-${mdKey(d)}`

// 这一天有哪些节日（数组，可能为空；元旦撞腊八这类会都在）
export function festivalsOn(date) {
  const out = []
  const md = mdKey(date)
  if (FIXED_FESTIVALS[md]) out.push(FIXED_FESTIVALS[md])
  const lunar = LUNAR_FESTIVALS[date.getFullYear()]
  if (lunar && lunar[md]) out.push(lunar[md])
  return out
}

// lamp_date（'YYYY-MM-DD' 或 date 字符串）安全取本地日期件，避开时区坑
function lampParts(lampDate) {
  if (!lampDate) return null
  const m = String(lampDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return { y: +m[1], md: `${m[2]}-${m[3]}`, d: +m[3] }
}

// 这一天亮着哪些灯（milestones 里匹配的行，原样返回，告不告诉他由调用方过滤）
export function lampsOn(date, milestones) {
  if (!milestones || milestones.length === 0) return []
  const md = mdKey(date)
  const ymd = ymdKey(date)
  const day = date.getDate()
  return milestones.filter(ms => {
    const rp = ms.repeat_type || 'yearly'
    if (rp === 'lunar') {
      // 农历灯：查逐年对照表（date_map = {"2026":"2026-09-21",...}）
      const map = ms.date_map || {}
      return map[String(date.getFullYear())] === ymd
    }
    const p = lampParts(ms.lamp_date)
    if (!p) return false
    if (rp === 'once') return `${p.y}-${p.md}` === ymd
    if (rp === 'monthly') return p.d === day
    return p.md === md // yearly
  })
}

// 广播用：这一天的特别话（给他的那句），无则空串。
// 只捎 notify_him 的灯；节日在前灯在后；确定性输出。
export function specialDayText(date, milestones) {
  const names = [...festivalsOn(date)]
  for (const ms of lampsOn(date, milestones)) {
    if (ms.notify_him !== false) names.push(ms.title)
  }
  return names.length ? `今天是${names.join('、')}` : ''
}

// 顶栏用：亮给她看的那句（灯优先于节日，一次只说一件，最贴心的那件）
export function headerSpecialText(date, milestones) {
  const lamps = lampsOn(date, milestones)
  if (lamps.length > 0) return `今天是${lamps[0].title} ☽`
  const fests = festivalsOn(date)
  if (fests.length > 0) return `今天是${fests[0]} 🌙`
  return ''
}

// 灯的日期怎么念（纪念日房间清单用）
export function lampDateLabel(ms) {
  const rp = ms.repeat_type || 'yearly'
  if (rp === 'lunar') return '农历 · 逐年对表'
  const p = lampParts(ms.lamp_date)
  if (!p) return ''
  if (rp === 'once') return `${p.y}年${+p.md.slice(0, 2)}月${p.d}日 · 仅这一天`
  if (rp === 'monthly') return `每月${p.d}日`
  return `每年${+p.md.slice(0, 2)}月${p.d}日`
}
