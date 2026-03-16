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

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })

    const recommend = await prisma.problemBank.findMany({
      where: user?.grade ? { grade: user.grade } : undefined,
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(recommend)
  } catch (error) {
    console.error('Get recommend error:', error)
    return NextResponse.json({ error: '获取推荐题目失败' }, { status: 500 })
  }
}
