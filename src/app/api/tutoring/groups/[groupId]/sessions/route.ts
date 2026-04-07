import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: '未授权或令牌无效' }, { status: 401 })
    }

    const sessions = await prisma.tutoringSession.findMany({
      where: { 
        groupId,
        userId: payload.userId
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        groupId: true,
        problemText: true,
        mode: true,
        difficulty: true,
        status: true,
        currentStep: true,
        createdAt: true
      }
    })

    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Get group sessions error:', error)
    return NextResponse.json({ error: '获取会话组失败' }, { status: 500 })
  }
}
