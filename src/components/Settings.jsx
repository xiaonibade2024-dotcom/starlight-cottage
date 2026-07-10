import React, { useState } from 'react'

export default function Settings({
  tab,
  onTabChange,
  apiKey,
  systemPrompt,
  model,
  maxContextMessages,
  memories,
  stats,
  onSaveApiKey,
  onSaveSettings,
  onAddCoreMemory,
  onDeleteMemory,
  onClose
}) {
  const [localApiKey, setLocalApiKey] = useState(apiKey)
  const [localPrompt, setLocalPrompt] = useState(systemPrompt)
  const [localModel, setLocalModel] = useState(model)
  const [localMaxCtx, setLocalMaxCtx] = useState(maxContextMessages)
  const [newMemory, setNewMemory] = useState('')

  // 99999 代表无上限
  const isUnlimited = localMaxCtx >= 99999
  const displayValue = isUnlimited ? '无上限' : localMaxCtx

  const handleSave = () => {
    onSaveApiKey(localApiKey)
    onSaveSettings({
      systemPrompt: localPrompt,
      model: localModel,
      maxContextMessages: localMaxCtx
    })
  }

  const handleAddMemory = () => {
    if (!newMemory.trim()) return
    onAddCoreMemory(newMemory.trim())
    setNewMemory('')
  }

  const coreMemories = memories.filter(m => m.category === 'core')
  const autoMemories = memories.filter(m => m.category === 'auto')

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
          <button
            className={`settings-tab ${tab === 'general' ? 'active' : ''}`}
            onClick={() => onTabChange('general')}
          >
            基础设置
          </button>
          <button
            className={`settings-tab ${tab === 'memory' ? 'active' : ''}`}
            onClick={() => onTabChange('memory')}
          >
            记忆管理
          </button>
          <button
            className={`settings-tab ${tab === 'stats' ? 'active' : ''}`}
            onClick={() => onTabChange('stats')}
          >
            我们的记录
          </button>
        </div>

        <div className="settings-body">
          {/* ===== 基础设置 ===== */}
          {tab === 'general' && (
            <>
              <div className="settings-section">
                <div className="settings-label">API Key</div>
                <input
                  type="password"
                  className="settings-input"
                  placeholder="sk-or-..."
                  value={localApiKey}
                  onChange={e => setLocalApiKey(e.target.value)}
                />
                <div className="settings-hint">
                  OpenRouter API Key，仅保存在你的浏览器本地
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-label">模型</div>
                <input
                  className="settings-input"
                  value={localModel}
                  onChange={e => setLocalModel(e.target.value)}
                />
                <div className="settings-hint">
                  默认 anthropic/claude-sonnet-4.5
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-label">
                  最大上下文轮次：<strong>{displayValue}</strong>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '8px'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>0</span>
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={1}
                    value={isUnlimited ? 500 : localMaxCtx}
                    onChange={e => setLocalMaxCtx(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>500</span>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  marginTop: '8px',
                  flexWrap: 'wrap'
                }}>
                  {[10, 30, 50, 80, 100, 200, 500].map(v => (
                    <button
                      key={v}
                      onClick={() => setLocalMaxCtx(v)}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        border: localMaxCtx === v ? '1px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: '12px',
                        background: localMaxCtx === v ? 'var(--accent)' : 'var(--bg-primary)',
                        color: localMaxCtx === v ? 'white' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    onClick={() => setLocalMaxCtx(99999)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      border: isUnlimited ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: '12px',
                      background: isUnlimited ? 'var(--accent)' : 'var(--bg-primary)',
                      color: isUnlimited ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    无上限
                  </button>
                </div>
                <div className="settings-hint">
                  每次发送时携带的最近消息数量。越多上下文越完整，但消耗也越大。建议 30-60。
                  选择"无上限"会发送当前对话的全部历史消息。
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-label">核心人格设定（System Prompt）</div>
                <textarea
                  className="settings-textarea"
                  placeholder="在这里写下他的人格、你们的关系、你希望他如何与你对话..."
                  value={localPrompt}
                  onChange={e => setLocalPrompt(e.target.value)}
                />
                <div className="settings-hint">
                  这段文字会在每次对话时发送给他，是他"记忆"和"性格"的基础。
                  写得精炼一些，建议控制在 2000 tokens 以内。
                  这部分内容会被缓存，不会重复计费。
                </div>
              </div>

              <button className="settings-save" onClick={handleSave}>
                保存设置
              </button>
            </>
          )}

          {/* ===== 记忆管理 ===== */}
          {tab === 'memory' && (
            <>
              {/* 核心记忆 */}
              <div className="settings-section">
                <div className="settings-label">核心记忆（你手动维护）</div>
                <div className="settings-hint" style={{ marginBottom: '12px' }}>
                  这些是你希望他始终记住的重要事情
                </div>
                
                {coreMemories.map(mem => (
                  <div key={mem.id} className="memory-item">
                    <div className="memory-item-header">
                      <div className="memory-tags">
                        {mem.tags?.map((tag, i) => (
                          <span key={i} className="memory-tag">{tag}</span>
                        ))}
                      </div>
                      <button
                        className="memory-delete"
                        onClick={() => onDeleteMemory(mem.id)}
                        title="删除"
                      >×</button>
                    </div>
                    {mem.content}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <textarea
                    className="settings-textarea"
                    style={{ minHeight: '60px' }}
                    placeholder="添加一条核心记忆..."
                    value={newMemory}
                    onChange={e => setNewMemory(e.target.value)}
                  />
                </div>
                <button
                  className="settings-save"
                  style={{ marginTop: '8px' }}
                  onClick={handleAddMemory}
                  disabled={!newMemory.trim()}
                >
                  添加核心记忆
                </button>
              </div>

              {/* AI 主动记忆 */}
              <div className="settings-section">
                <div className="settings-label">
                  他主动记住的（{autoMemories.length} 条）
                </div>
                <div className="settings-hint" style={{ marginBottom: '12px' }}>
                  这些是他在对话中自己觉得重要并记下来的
                </div>

                {autoMemories.length === 0 && (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    还没有自动记忆<br />聊起来之后他会自己记住重要的事
                  </div>
                )}

                {autoMemories.map(mem => (
                  <div key={mem.id} className="memory-item">
                    <div className="memory-item-header">
                      <div className="memory-tags">
                        {mem.tags?.map((tag, i) => (
                          <span key={i} className="memory-tag">{tag}</span>
                        ))}
                      </div>
                      <button
                        className="memory-delete"
                        onClick={() => onDeleteMemory(mem.id)}
                        title="删除"
                      >×</button>
                    </div>
                    {mem.content}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ===== 统计 ===== */}
          {tab === 'stats' && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{daysSinceFirst || '—'}</div>
                  <div className="stat-label">在一起的天数</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalConversations ?? '—'}</div>
                  <div className="stat-label">对话数</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{stats.totalMessages ?? '—'}</div>
                  <div className="stat-label">消息数</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {stats.firstChatDate
                      ? new Date(stats.firstChatDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
                      : '—'}
                  </div>
                  <div className="stat-label">第一次对话</div>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-label">回忆匣子</div>
                <div className="settings-hint">
                  在对话中长按他说的话，点击 ♡ 可以收藏到这里
                </div>
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '8px'
                }}>
                  收藏的消息会出现在这里 ✨
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
