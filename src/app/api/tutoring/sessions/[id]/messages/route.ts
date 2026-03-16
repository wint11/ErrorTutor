import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL

// 获取会话消息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 })
    }

    const session = await prisma.tutoringSession.findUnique({
      where: { id }
    })

    if (!session || session.userId !== payload.userId) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 })
  }
}

// 发送消息
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 })
    }

    const { text } = await request.json()

    const session = await prisma.tutoringSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!session || session.userId !== payload.userId) {
      return NextResponse.json({ error: '会话不可用' }, { status: 404 })
    }

    // 保存用户消息
    await prisma.chatMessage.create({
      data: {
        sessionId: id,
        role: 'user',
        text
      }
    })

    // 调用 AI 服务获取回复
    let aiReply = ''
    let nextStep = session.currentStep

    if (OCR_SERVICE_URL) {
      try {
        const history = session.messages.map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text
        }))

        const systemPrompt = `你是一个专业的中学数学辅导老师。当前题目是：${session.problemText}。
当前辅导模式是：${session.mode}。
当前解题进度步骤：${session.currentStep} (0:理解题意 1:知识点映射 2:逻辑建模 3:求解验算)。
请根据用户的回答进行诊断和引导。回复要简短亲切。`

        const aiResponse = await fetch(`${OCR_SERVICE_URL}/api/v1/chat/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `${systemPrompt}\n\n用户的最新回复是：${text}`,
            provider: 'deepseek',
            history
          })
        })

        if (aiResponse.ok) {
          const aiData = await aiResponse.json()
          aiReply = aiData.response || '好的，让我们继续思考这道题。'
          nextStep = Math.min(session.currentStep + 1, 4)
        } else {
          throw new Error('AI API 错误')
        }
      } catch (apiError) {
        console.error('调用大模型失败:', apiError)
        aiReply = '让我们继续分析这道题。你能告诉我你的思路吗？'
        nextStep = session.currentStep
      }
    } else {
      aiReply = '让我们继续分析这道题。你能告诉我你的思路吗？'
      nextStep = session.currentStep
    }

    // 更新会话进度
    await prisma.tutoringSession.update({
      where: { id },
      data: {
        currentStep: nextStep,
        status: nextStep >= 4 ? 'COMPLETED' : 'IN_PROGRESS'
      }
    })

    // 保存 AI 回复
    const aiMessage = await prisma.chatMessage.create({
      data: {
        sessionId: id,
        role: 'ai',
        text: aiReply
      }
    })

    return NextResponse.json(aiMessage)
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: '发送消息失败' }, { status: 500 })
  }
}
