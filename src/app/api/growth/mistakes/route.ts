import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: '未授权或令牌无效' }, { status: 401 })
    }

    const mistakes = await prisma.mistakeRecord.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(mistakes)
  } catch (error) {
    console.error('Get mistakes error:', error)
    return NextResponse.json({ error: '获取错题失败' }, { status: 500 })
  }
}
