import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'

export async function GET(
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
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    if (session.userId !== payload.userId) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 })
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error('Get session error:', error)
    return NextResponse.json({ error: '获取会话失败' }, { status: 500 })
  }
}
