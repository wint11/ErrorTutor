import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 })

  if (user.role !== 'STUDENT') {
    return NextResponse.json({ error: '只有学生可以查看学习任务' }, { status: 403 })
  }

  if (!user.classId) {
    return NextResponse.json([]) // 如果没有加入班级，返回空列表
  }

  const exercises = await prisma.exercise.findMany({
    where: { classId: user.classId },
    include: {
      class: { select: { name: true } },
      submissions: {
        where: { studentId: user.id },
        select: { id: true, isCorrect: true, createdAt: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Format the data for the frontend
  const formattedExercises = exercises.map(ex => {
    const isSubmitted = ex.submissions.length > 0
    const submission = isSubmitted ? ex.submissions[0] : null
    
    return {
      id: ex.id,
      title: ex.title,
      content: ex.content,
      knowledgePoint: ex.knowledgePoint,
      dueDate: ex.dueDate,
      createdAt: ex.createdAt,
      className: ex.class.name,
      status: isSubmitted ? 'COMPLETED' : 'PENDING',
      isCorrect: submission?.isCorrect,
      submittedAt: submission?.createdAt
    }
  })

  return NextResponse.json(formattedExercises)
}