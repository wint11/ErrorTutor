import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
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

    const userId = payload.userId

    // 获取统计数据
    const [resolvedCount, eliminatedCount, recentMistakes] = await Promise.all([
      prisma.tutoringSession.count({
        where: { userId, status: 'COMPLETED' }
      }),
      prisma.mistakeRecord.count({
        where: { userId, status: '已复习' }
      }),
      prisma.mistakeRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          problemText: true,
          errorType: true,
          createdAt: true
        }
      })
    ])

    // 找出最常见的错误类型
    const errorTypes = await prisma.mistakeRecord.groupBy({
      by: ['errorType'],
      where: { userId },
      _count: { errorType: true },
      orderBy: { _count: { errorType: 'desc' } },
      take: 1
    })

    return NextResponse.json({
      resolvedCount,
      eliminatedErrorsCount: eliminatedCount,
      mostFrequentError: errorTypes[0]?.errorType || '暂无数据',
      recentMistakes
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    )
  }
}
