import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'
import { chatCompletionStream } from '@/lib/llm'
import { PROMPTS } from '@/config/prompts'

export async function POST(request: NextRequest) {
  try {
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: '未授权或令牌无效' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { grade: true, level: true, textbookVersion: true }
    })

    const body = await request.json()
    const { type, topic, mode, difficulty, mistakeText } = body

    let prompt = ''
    if (type === 'challenge') {
      prompt = PROMPTS.generateChallenge(
        topic, 
        user?.grade || '初一', 
        user?.level || '中等', 
        user?.textbookVersion || '人教版'
      )
    } else if (type === 'practice') {
      prompt = PROMPTS.generatePractice(
        mode, 
        difficulty,
        user?.grade || '初一',
        user?.textbookVersion || '人教版',
        topic,
        mistakeText
      )
    } else {
      return NextResponse.json({ error: '无效的生成类型' }, { status: 400 })
    }

    const messages = [{ role: 'user' as const, content: prompt }]
    
    // 复用流式接口，但在此处作为普通的后端 API 收集完整结果
    // 因为这里我们只期望生成一道题并返回，不需要给前端推流
    const response = await chatCompletionStream(messages)
    
    if (!response.body) {
      throw new Error('No stream body found')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let aiReply = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6))
            const text = data.choices?.[0]?.delta?.content || ''
            if (text) {
              aiReply += text
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    return NextResponse.json({ problemText: aiReply.trim() })
  } catch (error) {
    console.error('Generate problem error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '生成题目失败' }, { status: 500 })
  }
}