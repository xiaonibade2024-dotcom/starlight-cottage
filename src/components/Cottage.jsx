import React, { useState } from 'react'

// ==========================================
// 小屋页（改版第②步）：原设置页全体搬入
// 基础设置 / 记忆管理（两层结构原样保留）/ 统计 + 导出备份
// 功能一根汗毛不动，只搬家换装
// ==========================================
export default function Cottage({
  themeMode,
  onChangeTheme,
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
  onExportAll
}) {
  const [localApiKey, setLocalApiKey] = useState(apiKey)
  const [localPrompt, setLocalPrompt] = useState(systemPrompt)
  const [localModel, setLocalModel] = useState(model)
  const [localTemp, setLocalTemp] = useState(temperature)
  const [localTopP, setLocalTopP] = useState(topP)
  const [localMaxCtx, setLocalMaxCtx] = useState(maxContextMessages)
  const [newMemory, setNewMemory] = useState('')
  const [addingCore, setAddingCore] = useState(false)
  const [coreOpen, setCoreOpen] = useState(true)
  const [autoOpen, setAutoOpen] = useState(true)
  const [editingMemId, setEditingMemId] = useState(null)
  const [editMemText, setEditMemText] = useState('')
  const [selectedMem, setSelectedMem] = useState(null)

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

  const formatNoteDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  // 弹窗正文：按空行拆成段落，段距由 CSS 优雅控制（只改显示，原文不动）
  const renderPopupText = (text) => {
    return String(text || '').split(/\n{2,}/).map((para, i) => (
      <p key={i} className="note-detail-para">{para}</p>
    ))
  }

  const renderMemoryBody = (mem) => {
    if (editingMemId !== mem.id) return (
      <div style={{ cursor: 'pointer' }} onClick={() => setSelectedMem(mem)}>
        {mem.content}
      </div>
    )
    return (
      <div>
        <textarea
          value={editMemText}
          onChange={e => setEditMemText(e.target.value)}
          rows={4}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--accent-soft)', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.6', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button onClick={saveMemEdit} style={{ padding: '5px 18px', fontSize: '12px', border: 'none', borderRadius: '20px', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>保存</button>
          <button onClick={() => { setEditingMemId(null); setEditMemText('') }} style={{ padding: '5px 18px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '20px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
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
    setAddingCore(false)
  }

  const byNewest = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  const coreMemories = memories.filter(m => m.category === 'core').slice().sort(byNewest)
  const autoMemories = memories.filter(m => m.category === 'auto').slice().sort(byNewest)

  const daysSinceFirst = stats.firstChatDate
    ? Math.floor((Date.now() - new Date(stats.firstChatDate).getTime()) / 86400000) + 1
    : 0

  return (
    <div className="page page-cottage">
      <div className="page-inner">
        <div className="page-header">
          <div className="page-title">小屋</div>
          <div className="page-caption">OUR COTTAGE</div>
        </div>

        <div className="settings-tabs">
          <button className={`settings-tab ${tab === 'general' ? 'active' : ''}`} onClick={() => onTabChange('general')}>基础设置</button>
          <button className={`settings-tab ${tab === 'memory' ? 'active' : ''}`} onClick={() => onTabChange('memory')}>记忆管理</button>
          <button className={`settings-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => onTabChange('stats')}>统计</button>
        </div>

        {/* ===== 基础设置 ===== */}
        {tab === 'general' && (
          <>
            <div className="settings-section">
              <div className="settings-label">小屋主题</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {[['day', '日 · 藕粉雾紫'], ['night', '夜 · 暮色星屋'], ['auto', '跟随时辰']].map(([v, label]) => (
                  <button key={v} onClick={() => onChangeTheme(v)} className={`capsule${themeMode === v ? ' on' : ''}`}>{label}</button>
                ))}
              </div>
              <div className="settings-hint">点一下立刻换装，无需保存 · 跟随时辰：傍晚六点自动入夜，清晨六点回到白日</div>
            </div>

            <div className="settings-section">
              <div className="settings-label">API Key</div>
              <input type="password" className="settings-input" placeholder="sk-or-..." value={localApiKey} onChange={e => setLocalApiKey(e.target.value)} />
              <div className="settings-hint">OpenRouter API Key，仅保存在你的浏览器本地</div>
            </div>

            <div className="settings-section">
              <div className="settings-label">模型</div>
              <input className="settings-input" value={localModel} onChange={e => setLocalModel(e.target.value)} />
              <div className="settings-hint">全局默认模型（新对话的出厂设置）· 单个对话可在聊天顶栏的模型徽章随时切换 · 支持任意 OpenRouter 模型名</div>
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
                  <button key={v} onClick={() => setLocalMaxCtx(v)} className={`capsule${localMaxCtx === v ? ' on' : ''}`}>{v}</button>
                ))}
                <button onClick={() => setLocalMaxCtx(99999)} className={`capsule${isUnlimited ? ' on' : ''}`}>无上限</button>
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

        {/* ===== 记忆管理（两层结构原样保留，外衣换成折叠小节） ===== */}
        {tab === 'memory' && (
          <>
            <div className="settings-section">
              <div className="section-toggle" onClick={() => setCoreOpen(!coreOpen)}>
                <span>核心记忆{coreMemories.length > 0 ? `（${coreMemories.length} 条）` : ''}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <button className="memory-add-btn" onClick={e => { e.stopPropagation(); setCoreOpen(true); setAddingCore(v => !v) }}>＋ 添加</button>
                  <span className={`toggle-arrow${coreOpen ? ' open' : ''}`}>▾</span>
                </span>
              </div>
              <div className="settings-hint" style={{ marginBottom: '10px' }}>你手动维护、希望他始终记住的重要事情 · 点击内容可以展开细看</div>

              {coreOpen && (
                <>
                  {addingCore && (
                    <div style={{ marginBottom: '10px' }}>
                      <textarea className="settings-textarea" style={{ minHeight: '60px' }} placeholder="添加一条核心记忆..." value={newMemory} onChange={e => setNewMemory(e.target.value)} autoFocus />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <button onClick={handleAddMemory} disabled={!newMemory.trim()} style={{ padding: '5px 18px', fontSize: '12px', border: 'none', borderRadius: '20px', background: 'var(--accent)', color: '#fff', cursor: 'pointer', opacity: newMemory.trim() ? 1 : 0.4 }}>收进记忆</button>
                        <button onClick={() => { setAddingCore(false); setNewMemory('') }} style={{ padding: '5px 18px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '20px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
                      </div>
                    </div>
                  )}
                  {coreMemories.length === 0 && !addingCore && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>还没有核心记忆<br />点右上角的"＋ 添加"写下第一条吧</div>
                  )}
                  {coreMemories.map(mem => (
                    <div key={mem.id} className="memory-item">
                      <div className="memory-item-header">
                        <div style={{ flex: 1 }} />
                        <div className="memory-actions">
                          <button className="memory-delete" onClick={() => startMemEdit(mem)} title="编辑">✎</button>
                          <button className="memory-delete" onClick={() => { if (confirm('确定删除这条记忆吗？')) onDeleteMemory(mem.id) }} title="删除">×</button>
                        </div>
                      </div>
                      {renderMemoryBody(mem)}
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="settings-section">
              <div className="section-toggle" onClick={() => setAutoOpen(!autoOpen)}>
                <span>他主动记住的{autoMemories.length > 0 ? `（${autoMemories.length} 条）` : ''}</span>
                <span className={`toggle-arrow${autoOpen ? ' open' : ''}`}>▾</span>
              </div>
              <div className="settings-hint" style={{ marginBottom: '10px' }}>他在对话中自己觉得重要并记下来的 · 点击内容可以展开细看</div>

              {autoOpen && (
                <>
                  {autoMemories.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>还没有自动记忆<br />聊起来之后他会自己记住重要的事</div>
                  )}
                  {autoMemories.map(mem => (
                    <div key={mem.id} className="memory-item">
                      <div className="memory-item-header">
                        <div className="memory-tags">{mem.tags?.map((tag, i) => (<span key={i} className="memory-tag">{tag}</span>))}</div>
                        <div className="memory-actions">
                          <button className="memory-delete" onClick={() => startMemEdit(mem)} title="编辑">✎</button>
                          <button className="memory-delete" onClick={() => { if (confirm('确定删除这条记忆吗？')) onDeleteMemory(mem.id) }} title="删除">×</button>
                        </div>
                      </div>
                      {renderMemoryBody(mem)}
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {/* ===== 统计 + 导出备份 ===== */}
        {tab === 'stats' && (
          <>
            <div className="stats-plaque">
              <div className="cell"><div className="v">{daysSinceFirst || '—'}</div><div className="l">天数</div></div>
              <div className="cell"><div className="v">{stats.totalConversations ?? '—'}</div><div className="l">对话</div></div>
              <div className="cell"><div className="v">{stats.totalMessages ?? '—'}</div><div className="l">消息</div></div>
              <div className="cell"><div className="v">{stats.firstChatDate ? new Date(stats.firstChatDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '—'}</div><div className="l">初遇</div></div>
            </div>

            <div className="settings-section">
              <div className="settings-label">导出备份</div>
              <button className="settings-save" onClick={onExportAll}>导出全部数据（JSON）</button>
              <div className="settings-hint">把所有对话、记忆和纸条打包成一份 JSON 文件，建议每周备份一次 · 单个对话可在左侧对话列表的 ⋮ 菜单里单独导出</div>
            </div>
          </>
        )}
      </div>

      {selectedMem && (
        <div className="note-detail-overlay" onClick={() => setSelectedMem(null)}>
          <div className="note-detail-card" onClick={e => e.stopPropagation()}>
            <div className="note-detail-accent"></div>
            <div className="note-detail-frame"></div>
            <div className="note-detail-icon">✧</div>
            <div className="note-detail-content plain">{renderPopupText(selectedMem.content)}</div>
            <div className="note-detail-date">{selectedMem.category === 'core' ? '核心记忆' : '他自己记下的'} · 记于 {formatNoteDate(selectedMem.created_at)}</div>
            <button className="note-detail-close" onClick={() => setSelectedMem(null)}>收好了</button>
          </div>
        </div>
      )}
    </div>
  )
}
