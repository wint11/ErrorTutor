import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'
import { getNodeTitleById } from '@/lib/knowledge'

export async function GET(request: NextRequest) {
  try {
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: '未授权或令牌无效' }, { status: 401 })
    }

    // 1. 获取薄弱点 (查漏补缺)
    const stats = await prisma.userMasteredNode.findMany({
      where: { userId: payload.userId },
    })

    const weakPoints = stats
      .map(stat => {
        const errorRate = stat.totalPracticed > 0 ? (stat.errorCount / stat.totalPracticed) * 100 : 0
        return {
          ...stat,
          errorRate,
          title: getNodeTitleById(stat.nodeId) || stat.nodeId
        }
      })
      .filter(stat => stat.errorRate > 30 && stat.totalPracticed > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 20) // 取前20个薄弱点

    // 2. 获取错题 (错题复习)
    // 包含两部分：用户自己上传的题目 (AppUpload，status != 'pending')，在线上练习的错题 (MistakeRecord)
    const onlineMistakes = await prisma.mistakeRecord.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const appUploads = await prisma.appUpload.findMany({
      where: { userId: payload.userId, status: { not: 'pending' } },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const mistakes = [
      ...onlineMistakes.map(m => ({
        id: m.id,
        source: 'online',
        text: m.problemText,
        knowledgePoint: m.knowledgePoint,
        createdAt: m.createdAt
      })),
      ...appUploads.map(m => ({
        id: m.id,
        source: 'upload',
        text: m.ocrText || '未知题目内容',
        imageUrl: m.imageUrl,
        createdAt: m.createdAt,
        grade: m.grade
      }))
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return NextResponse.json({
      weakPoints,
      mistakes
    })
  } catch (error) {
    console.error('Get recommend error:', error)
    return NextResponse.json({ error: '获取推荐数据失败' }, { status: 500 })
  }
}
