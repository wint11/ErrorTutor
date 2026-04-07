import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: '未授权或令牌无效' }, { status: 401 })
    }

    const stats = await prisma.userMasteredNode.findMany({
      where: { userId: payload.userId },
      select: {
        nodeId: true,
        errorCount: true,
        totalPracticed: true,
        isMastered: true
      }
    })

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Get knowledge stats error:', error)
    return NextResponse.json({ error: '获取知识图谱统计失败' }, { status: 500 })
  }
}
