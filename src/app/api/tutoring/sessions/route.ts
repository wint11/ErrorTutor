import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'

// 创建新会话
export async function POST(request: NextRequest) {
  try {
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json(
        { error: '未授权或令牌无效' },
        { status: 401 }
      )
    }

    const { problemText, mode = '通用辅导', timeLimit, difficulty = '中等', groupId, questionCount = 1, topic, mistakeText } = await request.json()

    if (!problemText) {
      return NextResponse.json(
        { error: '题目内容不能为空' },
        { status: 400 }
      )
    }

    let problemContent = problemText
    let knowledgePoint = null
    const kpMatch = problemContent.match(/<knowledge>([\s\S]*?)<\/knowledge>/)
    if (kpMatch) {
      knowledgePoint = kpMatch[1].trim()
      problemContent = problemContent.replace(/<knowledge>[\s\S]*?<\/knowledge>/g, '').trim()
    }

    const createdSessions = []
    const finalGroupId = groupId || Date.now().toString() + Math.random().toString(36).substr(2, 9)
    
    // 生成指定的题目数量
    for (let i = 0; i < questionCount; i++) {
      const isFirst = i === 0;
      
      const session = await prisma.tutoringSession.create({
        data: {
          userId: payload.userId,
          groupId: finalGroupId,
          problemText: isFirst ? problemContent : '题目生成中...',
          knowledgePoint: isFirst ? knowledgePoint : null,
          mode,
          difficulty,
          topic,
          mistakeText,
          status: isFirst ? 'IN_PROGRESS' : 'PENDING',
          currentStep: 0,
          timeLimit: timeLimit ? parseInt(timeLimit) : null
        }
      })
      
      createdSessions.push(session)
      
      if (isFirst) {
        // 创建初始 AI 消息
        await prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 'ai',
            text: `你好！我是你的AI数学导师。我们来一起解决这道题目吧。\n\n题目：${problemContent}\n\n首先，请你告诉我，你觉得这道题的已知条件是什么？所求又是什么？`
          }
        })
      }
    }

    return NextResponse.json({
      id: createdSessions[0].id,
      groupId: createdSessions[0].groupId,
      problemText: createdSessions[0].problemText,
      knowledgePoint: createdSessions[0].knowledgePoint,
      mode: createdSessions[0].mode,
      currentStep: createdSessions[0].currentStep,
      timeLimit: createdSessions[0].timeLimit,
      messages: [{
        id: '1',
        role: 'ai',
        text: `你好！我是你的AI数学导师。我们来一起解决这道题目吧。\n\n题目：${problemContent}\n\n首先，请你告诉我，你觉得这道题的已知条件是什么？所求又是什么？`
      }]
    }, { status: 201 })
  } catch (error) {
    console.error('Create session error:', error)
    return NextResponse.json(
      { error: '创建会话失败' },
      { status: 500 }
    )
  }
}
