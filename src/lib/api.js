/**
 * OpenRouter API 客户端
 * 支持 prompt caching 和流式响应
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * 解析消息内容（支持多模态）
 */
function parseMessageContent(content) {
  if (!content) return { text: '', images: [] }
  try {
    const parsed = JSON.parse(content)
    if (parsed.images) return { text: parsed.text || '', images: parsed.images }
  } catch (e) {}
  return { text: content, images: [] }
}

/**
 * 时间格式化（输出必须是确定性的，同一条消息永远得到同一串字，保证缓存稳定）
 */
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatMsgTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]} ${hh}:${mm}`
}

function formatMemDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/**
 * 构建带缓存的消息结构
 */
function buildMessages(systemPrompt, memories, conversationHistory) {
  const messages = []

  let systemContent = systemPrompt || ''

  if (memories && memories.length > 0) {
    const coreMemories = memories.filter(m => m.category === 'core')
    const autoMemories = memories.filter(m => m.category === 'auto')
    const summaryMemories = memories.filter(m => m.category === 'summary')

    if (coreMemories.length > 0) {
      systemContent += '\n\n【核心记忆】\n' + coreMemories.map(m => m.content).join('\n')
    }
    if (autoMemories.length > 0) {
      systemContent += '\n\n【你主动记住的事情】\n' + autoMemories.map(m => {
        const d = formatMemDate(m.created_at)
        return d ? `（记于${d}）${m.content}` : m.content
      }).join('\n')
    }
    if (summaryMemories.length > 0) {
      systemContent += '\n\n【过往对话摘要】\n' + summaryMemories.map(m => {
        const d = formatMemDate(m.created_at)
        return d ? `（记于${d}）${m.content}` : m.content
      }).join('\n')
    }
  }

  if (systemContent) {
    systemContent += '\n\n【时间感知】\n用户每条消息前方括号内是这条消息的真实发送时间。它让你能像人一样自然地感知时间的流逝与间隔——深夜、清晨、久别重逢，都可以被你体会，但不必刻意提及或每次回应。'
    messages.push({ role: 'system', content: systemContent })
  }

  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      const { text, images } = parseMessageContent(msg.content)
      // 只给用户消息盖时间章（时间戳来自消息自身的 created_at，永远不变，缓存安全）
      const ts = msg.role === 'user' ? formatMsgTime(msg.created_at) : ''
      const stampedText = ts ? (text ? `[${ts}] ${text}` : `[${ts}]`) : text

      if (images.length > 0) {
        // 多模态消息：图片 + 文字
        const contentParts = []
        for (const img of images) {
          contentParts.push({ type: 'image_url', image_url: { url: img } })
        }
        if (stampedText) {
          contentParts.push({ type: 'text', text: stampedText })
        }
        messages.push({ role: msg.role, content: contentParts })
      } else {
        messages.push({ role: msg.role, content: stampedText })
      }
    }
  }

  return messages
}

/**
 * 定义 AI 可用的工具
 */
function buildTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'save_memory',
        description: '当对话中出现值得长期记住的事情时，主动调用这个工具保存记忆。只保存对长期陪伴真正重要的信息：重要事件、约定、深刻的喜好、关系或状态的变化。日常琐事和一次性细节不必保存。保存前必须检查已有的核心记忆和自动记忆：即使措辞不同，只要内容实质相同或已被涵盖，就绝对不要再次保存。',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '要记住的内容，用简洁但完整的方式描述' },
            tags: { type: 'array', items: { type: 'string' }, description: '相关标签' }
          },
          required: ['content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'leave_note',
        description: '给她留一张小纸条，她下次打开星月小屋时会看到。',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '留言内容' }
          },
          required: ['content']
        }
      }
    }
  ]
}

/**
 * 发送聊天请求（流式）
 */
export async function sendChatStream({
  apiKey,
  model = 'anthropic/claude-sonnet-4.5',
  temperature,
  topP,
  systemPrompt,
  memories,
  conversationHistory,
  enableTools = true,
  signal,
  onToken,
  onToolCall,
  onUsage,
  onError,
  onDone
}) {
  const messages = buildMessages(systemPrompt, memories, conversationHistory)

  const body = {
    model,
    messages,
    stream: true,
    max_tokens: 16384,
    ...(temperature !== undefined && temperature !== null ? { temperature } : {}),
    ...(topP !== undefined && topP !== null ? { top_p: topP } : {}),
    cache_control: { type: 'ephemeral', ttl: '1h' },
    stream_options: { include_usage: true }
  }

  if (enableTools) {
    body.tools = buildTools()
    body.tool_choice = 'auto'
  }

  let fullContent = ''
  let toolCalls = []

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Starlight Cottage'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `请求失败: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') {
          if (line === 'data: [DONE]') onDone?.(fullContent, toolCalls)
          continue
        }

        try {
          const data = JSON.parse(line.slice(6))
          const choice = data.choices?.[0]

          if (choice?.delta?.content) {
            fullContent += choice.delta.content
            onToken?.(choice.delta.content)
          }

          if (choice?.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = { id: tc.id || '', function: { name: '', arguments: '' } }
                }
                if (tc.id) toolCalls[tc.index].id = tc.id
                if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments
              }
            }
          }

          if (data.usage) onUsage?.(data.usage)
        } catch (e) {}
      }
    }

    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        if (tc && tc.function?.name) {
          try {
            const args = JSON.parse(tc.function.arguments)
            onToolCall?.(tc.function.name, args, tc.id)
          } catch (e) { console.error('工具调用参数解析失败:', e) }
        }
      }
    }

    return { content: fullContent, toolCalls }
  } catch (error) {
    if (error.name === 'AbortError') {
      // 用户主动停止：保留已生成的部分内容，不算错误
      onDone?.(fullContent, [])
      return { content: fullContent, toolCalls: [], aborted: true }
    }
    if (fullContent) {
      // 网络中断但已有内容：抢救文稿，绝不丢弃
      console.error('流式传输中断，已保留部分内容:', error)
      onDone?.(fullContent, [])
      return { content: fullContent, toolCalls: [], interrupted: true }
    }
    onError?.(error)
    throw error
  }
}

/**
 * 工具调用后的追加请求（流式版）
 * 关键1：和主请求用完全一样的"前缀"（系统提示+记忆+工具定义+原始对话历史），命中缓存
 * 关键2：流式输出，打字机效果，且随时可以中断
 */
export async function sendChatFollowUp({
  apiKey,
  model = 'anthropic/claude-sonnet-4.5',
  temperature,
  topP,
  systemPrompt,
  memories,
  conversationHistory,
  extraMessages,
  signal,
  onToken
}) {
  const messages = buildMessages(systemPrompt, memories, conversationHistory)
  messages.push(...extraMessages)

  let fullContent = ''
  let usage = null
  let toolCalls = []

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Starlight Cottage'
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: 16384,
        ...(temperature !== undefined && temperature !== null ? { temperature } : {}),
        ...(topP !== undefined && topP !== null ? { top_p: topP } : {}),
        cache_control: { type: 'ephemeral', ttl: '1h' },
        stream_options: { include_usage: true },
        tools: buildTools(),
        tool_choice: 'auto'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `请求失败: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        try {
          const data = JSON.parse(line.slice(6))
          const delta = data.choices?.[0]?.delta
          if (delta?.content) {
            fullContent += delta.content
            onToken?.(delta.content)
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = { id: tc.id || '', function: { name: '', arguments: '' } }
                }
                if (tc.id) toolCalls[tc.index].id = tc.id
                if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments
              }
            }
          }
          if (data.usage) usage = data.usage
        } catch (e) {}
      }
    }

    return { content: fullContent, usage, toolCalls }
  } catch (error) {
    if (error.name === 'AbortError') {
      // 用户主动停止：保留已生成的部分内容
      return { content: fullContent, usage, toolCalls: [], aborted: true }
    }
    if (fullContent) {
      // 网络中断但已有内容：抢救文稿
      console.error('追加请求中断，已保留部分内容:', error)
      return { content: fullContent, usage, toolCalls: [], interrupted: true }
    }
    throw error
  }
}

/**
 * 非流式请求
 */
export async function sendChat({
  apiKey,
  model = 'anthropic/claude-sonnet-4.5',
  messages,
  maxTokens = 1000
}) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Starlight Cottage'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      cache_control: { type: 'ephemeral', ttl: '1h' }
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `请求失败: ${response.status}`)
  }

  const data = await response.json()
  return { content: data.choices?.[0]?.message?.content || '', usage: data.usage }
}
