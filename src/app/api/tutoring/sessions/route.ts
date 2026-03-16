import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// 创建新会话
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: '无效的令牌' },
        { status: 401 }
      )
    }

    const { problemText, mode = '通用辅导' } = await request.json()

    if (!problemText) {
      return NextResponse.json(
        { error: '题目内容不能为空' },
        { status: 400 }
      )
    }

    const session = await prisma.tutoringSession.create({
      data: {
        userId: payload.userId,
        problemText,
        mode,
        status: 'IN_PROGRESS',
        currentStep: 0
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
      id: session.id,
      problemText: session.problemText,
      mode: session.mode,
      currentStep: session.currentStep,
      messages: [initialMessage]
    }, { status: 201 })
  } catch (error) {
    console.error('Create session error:', error)
    return NextResponse.json(
      { error: '创建会话失败' },
      { status: 500 }
    )
  }
}
