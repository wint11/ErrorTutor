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

    // 获取用户信息以显示学段和学力
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { grade: true, level: true }
    })

    // 获取今天的日期边界
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 获取统计数据
    const [
      resolvedCount, 
      eliminatedCount, 
      todaySessions,
      allSessions
    ] = await Promise.all([
      prisma.tutoringSession.count({
        where: { userId, status: 'COMPLETED' }
      }),
      prisma.mistakeRecord.count({
        where: { userId, status: '已复习' }
      }),
      // 获取今天创建的辅导会话
      prisma.tutoringSession.findMany({
        where: { 
          userId,
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          problemText: true,
          status: true,
          createdAt: true
        }
      }),
      // 获取用户所有的会话以计算连续学习天数和总辅导时长
      prisma.tutoringSession.findMany({
        where: { userId },
        select: { createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'desc' }
      })
    ])

    // 计算连续打卡天数
    let streakDays = 0
    if (allSessions.length > 0) {
      const dates = new Set(allSessions.map(s => s.createdAt.toISOString().split('T')[0]))
      const sortedDates = Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      
      let currentDate = new Date()
      currentDate.setHours(0, 0, 0, 0)
      
      // 检查今天是否打卡
      const firstDateStr = sortedDates[0]
      const firstDate = new Date(firstDateStr)
      firstDate.setHours(0, 0, 0, 0)
      
      if (currentDate.getTime() - firstDate.getTime() <= 86400000) {
        streakDays = 1
        let checkDate = new Date(firstDate)
        for (let i = 1; i < sortedDates.length; i++) {
          checkDate.setDate(checkDate.getDate() - 1)
          const expectedStr = checkDate.toISOString().split('T')[0]
          if (sortedDates[i] === expectedStr) {
            streakDays++
          } else {
            break
          }
        }
      }
    }

    // 粗略计算今日辅导时长 (以每个session 5分钟为基础，如果有跨度则用跨度计算，最多计算30分钟/题)
    let todayStudyMinutes = 0
    todaySessions.forEach(session => {
      // 如果我们能获取到该session的具体更新时间，可以算差值，但为了简单，直接每题算个基础时长+对话数
      // 这里简化处理：每解决一道题算15分钟，未完成算5分钟
      if (session.status === 'COMPLETED') todayStudyMinutes += 15
      else todayStudyMinutes += 5
    })

    // 找出最常见的错误类型用于推荐
    const errorTypes = await prisma.mistakeRecord.groupBy({
      by: ['errorType'],
      where: { userId },
      _count: { errorType: true },
      orderBy: { _count: { errorType: 'desc' } },
      take: 1
    })

    return NextResponse.json({
      grade: user?.grade || '未知',
      level: user?.level || '未知',
      resolvedCount,
      eliminatedErrorsCount: eliminatedCount,
      mostFrequentError: errorTypes[0]?.errorType || '暂无数据',
      todayStudyMinutes,
      streakDays,
      todaySessions
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    )
  }
}
