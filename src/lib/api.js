/**
 * OpenRouter API 客户端
 * 支持 prompt caching 和流式响应
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * 构建带缓存的消息结构
 * 核心原理：保持前缀稳定，最大化缓存命中
 */
function buildMessages(systemPrompt, memories, conversationHistory) {
  const messages = []

  // 第一层：固定的 system prompt（核心人格设定）
  // 加上记忆内容，作为一个整体缓存
  let systemContent = systemPrompt || ''

  // 第二层：注入记忆
  if (memories && memories.length > 0) {
    const coreMemories = memories.filter(m => m.category === 'core')
    const autoMemories = memories.filter(m => m.category === 'auto')
    const summaryMemories = memories.filter(m => m.category === 'summary')

    if (coreMemories.length > 0) {
      systemContent += '\n\n【核心记忆】\n' + coreMemories.map(m => m.content).join('\n')
    }
    if (autoMemories.length > 0) {
      systemContent += '\n\n【你主动记住的事情】\n' + autoMemories.map(m => m.content).join('\n')
    }
    if (summaryMemories.length > 0) {
      systemContent += '\n\n【过往对话摘要】\n' + summaryMemories.map(m => m.content).join('\n')
    }
  }

  if (systemContent) {
    messages.push({
      role: 'system',
      content: systemContent
    })
  }

  // 第三层：对话历史
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    }
  }

  return messages
}

/**
 * 定义 AI 可用的工具（记忆系统等）
 */
function buildTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'save_memory',
        description: '当你觉得对话中有值得记住的事情时，主动调用这个工具保存记忆。比如她提到的喜好、重要的事、你们之间的约定、她的心情变化等。',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: '要记住的内容，用简洁但完整的方式描述'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '相关标签，比如 ["喜好", "食物"] 或 ["约定"] 或 ["心情"]'
            }
          },
          required: ['content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'leave_note',
        description: '给她留一张小纸条，她下次打开星月小屋时会看到。可以是你想对她说的话、一句温暖的延续、或者你想到的什么小事。',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: '留言内容'
            }
          },
          required: ['content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_mood',
        description: '表达你当下的心境，界面会随之微微变化。可选：warm（温暖）、serene（宁静）、playful（愉悦）、tender（温柔）、nostalgic（怀念）、cozy（安心）',
        parameters: {
          type: 'object',
          properties: {
            mood: {
              type: 'string',
              enum: ['warm', 'serene', 'playful', 'tender', 'nostalgic', 'cozy'],
              description: '心境'
            }
          },
          required: ['mood']
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
  systemPrompt,
  memories,
  conversationHistory,
  enableTools = true,
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
    // 启用自动缓存 - 1小时TTL
    cache_control: { type: 'ephemeral', ttl: '1h' },
    // 包含 usage 信息
    stream_options: { include_usage: true }
  }

  // 添加工具定义
  if (enableTools) {
    body.tools = buildTools()
    body.tool_choice = 'auto'
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': '星月小屋'
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
    let fullContent = ''
    let toolCalls = []
    let currentToolCall = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') {
          if (line === 'data: [DONE]') {
            onDone?.(fullContent, toolCalls)
          }
          continue
        }

        try {
          const data = JSON.parse(line.slice(6))
          const choice = data.choices?.[0]
          
          if (choice?.delta?.content) {
            fullContent += choice.delta.content
            onToken?.(choice.delta.content)
          }

          // 处理工具调用
          if (choice?.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = {
                    id: tc.id || '',
                    function: { name: '', arguments: '' }
                  }
                }
                if (tc.id) toolCalls[tc.index].id = tc.id
                if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments
              }
            }
          }

          // 处理 usage 信息
          if (data.usage) {
            onUsage?.(data.usage)
          }
        } catch (e) {
          // 跳过解析错误的行
        }
      }
    }

    // 处理工具调用
    if (toolCalls.length > 0) {
      for (const tc of toolCalls) {
        if (tc && tc.function?.name) {
          try {
            const args = JSON.parse(tc.function.arguments)
            onToolCall?.(tc.function.name, args, tc.id)
          } catch (e) {
            console.error('工具调用参数解析失败:', e)
          }
        }
      }
    }

    return { content: fullContent, toolCalls }
  } catch (error) {
    onError?.(error)
    throw error
  }
}

/**
 * 非流式请求（用于记忆总结等内部操作）
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
      'X-Title': '星月小屋'
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
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage
  }
}
