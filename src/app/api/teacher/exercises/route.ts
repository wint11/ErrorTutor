import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const exercises = await prisma.exercise.findMany({
    where: { class: { teacherId: user.id } },
    include: { class: { select: { name: true } }, _count: { select: { submissions: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(exercises)
}

export async function POST(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { title, content, classIds, dueDate, knowledgePoint } = await request.json()
  if (!title || !content || !classIds || !Array.isArray(classIds) || classIds.length === 0) {
    return NextResponse.json({ error: '标题、内容、班级不能为空' }, { status: 400 })
  }

  // 验证所有传入的班级是否都属于该教师
  const classObjs = await prisma.class.findMany({
    where: {
      id: { in: classIds }
    }
  })

  const invalidClasses = classObjs.filter(c => c.teacherId !== user.id)
  if (invalidClasses.length > 0 || classObjs.length !== classIds.length) {
    return NextResponse.json({ error: '部分班级不存在或无权限' }, { status: 403 })
  }

  // 批量创建练习
  const createPromises = classIds.map(classId => {
    return prisma.exercise.create({
      data: {
        title,
        content,
        classId,
        knowledgePoint,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    })
  })

  const exercises = await Promise.all(createPromises)
  return NextResponse.json({ success: true, count: exercises.length, exercises })
}
