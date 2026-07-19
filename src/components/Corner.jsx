import React from 'react'

// ==========================================
// 一隅页（改版第②步）：安静的占位
// 他的生活动态在第⑦步入住；院规四条见图纸
// ==========================================
export default function Corner() {
  return (
    <div className="page page-corner">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-title">一隅</div>
          <div className="page-caption">A QUIET CORNER</div>
        </div>
        <div className="empty-state" style={{ minHeight: '55vh' }}>
          <div className="empty-state-icon">🌙</div>
          <div className="empty-state-text">院子还在慢慢筑砌<br />等它落成，他生活里的动静会住进这里</div>
        </div>
      </div>
    </div>
  )
}
