import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 })
    }

    const userId = payload.userId

    const [totalMistakes, resolvedMistakes, recentMistakes] = await Promise.all([
      prisma.mistakeRecord.count({ where: { userId } }),
      prisma.mistakeRecord.count({ where: { userId, status: '已复习' } }),
      prisma.mistakeRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ])

    return NextResponse.json({
      totalMistakes,
      resolvedMistakes,
      recentMistakes
    })
  } catch (error) {
    console.error('Get growth stats error:', error)
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 })
  }
}
