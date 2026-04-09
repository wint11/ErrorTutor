import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const teacherId = user.id

  try {
    const [classCount, studentCount, exerciseCount, recentExercises] = await Promise.all([
      prisma.class.count({ where: { teacherId } }),
      prisma.user.count({ where: { role: 'STUDENT', class: { teacherId } } }),
      prisma.exercise.count({ where: { class: { teacherId } } }),
      prisma.exercise.findMany({
        where: { class: { teacherId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          class: { select: { name: true } },
          _count: { select: { submissions: true } }
        }
      })
    ])

    return NextResponse.json({
      classCount,
      studentCount,
      exerciseCount,
      recentExercises
    })
  } catch (error) {
    console.error('Teacher dashboard stats error:', error)
    return NextResponse.json({ error: '获取统计数据失败' }, { status: 500 })
  }
}
