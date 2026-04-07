import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'
import { chatCompletionStream } from '@/lib/llm'
import { PROMPTS } from '@/config/prompts'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: '未授权或令牌无效' }, { status: 401 })
    }

    const session = await prisma.tutoringSession.findUnique({
      where: { id }
    })

    if (!session || session.userId !== payload.userId) {
      return NextResponse.json({ error: '会话不存在或无权访问' }, { status: 404 })
    }

    if (session.status !== 'PENDING') {
      return NextResponse.json({ error: '该题目已经生成' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { grade: true, level: true, textbookVersion: true }
    })

    // 生成题目
    let prompt = PROMPTS.generatePractice(
      session.mode || '通用辅导', 
      session.difficulty || '中等',
      user?.grade || '初一',
      user?.textbookVersion || '人教版',
      session.topic || undefined,
      session.mistakeText || undefined
    )

    const messages = [{ role: 'user' as const, content: prompt }]
    const response = await chatCompletionStream(messages)
    
    if (!response.body) throw new Error('No stream body found')

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
            if (text) aiReply += text
          } catch (e) {
            // ignore
          }
        }
      }
    }

    let problemText = aiReply.trim()
    let knowledgePoint = null
    const kpMatch = problemText.match(/<knowledge>([\s\S]*?)<\/knowledge>/)
    if (kpMatch) {
      knowledgePoint = kpMatch[1].trim()
      problemText = problemText.replace(/<knowledge>[\s\S]*?<\/knowledge>/g, '').trim()
    }

    // 更新 session
    const updatedSession = await prisma.tutoringSession.update({
      where: { id },
      data: {
        problemText,
        knowledgePoint,
        status: 'IN_PROGRESS'
      }
    })

    // 创建初始 AI 消息
    const initialMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'ai',
        text: `你好！我是你的AI数学导师。我们来一起解决这道题目吧。\n\n题目：${problemText}\n\n首先，请你告诉我，你觉得这道题的已知条件是什么？所求又是什么？`
      }
    })

    return NextResponse.json({
      ...updatedSession,
      messages: [initialMessage]
    })
  } catch (error) {
    console.error('Start pending session error:', error)
    return NextResponse.json({ error: '生成题目失败' }, { status: 500 })
  }
}
