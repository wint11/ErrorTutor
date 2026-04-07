import { NextResponse } from 'next/server'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
}

function getLLMConfig(): LLMConfig {
  const provider = process.env.LLM_PROVIDER || 'deepseek'
  
  switch (provider.toLowerCase()) {
    case 'deepseek':
      return {
        provider: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model: 'deepseek-chat'
      }
    case 'glm':
      return {
        provider: 'glm',
        apiKey: process.env.ZHIPU_API_KEY || '',
        baseUrl: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4-flash'
      }
    case 'qwen':
      return {
        provider: 'qwen',
        apiKey: process.env.DASHSCOPE_API_KEY || '',
        baseUrl: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
        model: 'qwen-turbo'
      }
    case 'kimi':
      return {
        provider: 'kimi',
        apiKey: process.env.KIMI_API_KEY || '',
        baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
        model: 'moonshot-v1-8k'
      }
    default:
      return {
        provider: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model: 'deepseek-chat'
      }
  }
}

export async function chatCompletionStream(messages: Message[]) {
  const config = getLLMConfig()

  if (!config.apiKey) {
    throw new Error(`请在环境变量中配置 ${config.provider.toUpperCase()}_API_KEY`)
  }

  // 构建 OpenAI 兼容的请求
  const url = config.baseUrl.endsWith('/chat/completions') 
    ? config.baseUrl 
    : `${config.baseUrl}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages,
      temperature: 0.3,
      stream: true
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`大模型请求失败: ${response.status} ${errorText}`)
  }

  return response
}
