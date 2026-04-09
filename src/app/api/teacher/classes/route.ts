import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const classes = await prisma.class.findMany({
    where: { teacherId: user.id },
    include: { _count: { select: { students: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(classes)
}

export async function POST(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { name } = await request.json()
  if (!name) return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 })

  const newClass = await prisma.class.create({
    data: {
      name,
      teacherId: user.id
    }
  })
  return NextResponse.json(newClass)
}

export async function PUT(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { id, name } = await request.json()
  if (!id || !name) return NextResponse.json({ error: '参数不完整' }, { status: 400 })

  // 确保班级属于该教师
  const targetClass = await prisma.class.findUnique({ where: { id } })
  if (!targetClass || targetClass.teacherId !== user.id) {
    return NextResponse.json({ error: '无权限修改该班级' }, { status: 403 })
  }

  const updatedClass = await prisma.class.update({
    where: { id },
    data: { name }
  })
  
  return NextResponse.json(updatedClass)
}

export async function DELETE(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少班级ID' }, { status: 400 })

  // 确保班级属于该教师
  const targetClass = await prisma.class.findUnique({ where: { id } })
  if (!targetClass || targetClass.teacherId !== user.id) {
    return NextResponse.json({ error: '无权限删除该班级' }, { status: 403 })
  }

  // 级联删除处理：班级关联了学生(User)、练习(Exercise)。
  // 学生(User)又关联了许多记录(TutoringSession, MistakeRecord, ExerciseSubmission, 等等)。
  // 为了彻底清理而避免外键约束错误，我们需要按顺序自底向上删除，
  // 或者在 schema 中使用 onDelete: Cascade（但因为不能随便改 schema，这里手动清理）

  // 1. 查找该班级下的所有学生 ID 和练习 ID
  const students = await prisma.user.findMany({ where: { classId: id }, select: { id: true } })
  const studentIds = students.map(s => s.id)

  const exercises = await prisma.exercise.findMany({ where: { classId: id }, select: { id: true } })
  const exerciseIds = exercises.map(e => e.id)

  if (studentIds.length > 0) {
    // 1.1 删除学生关联的 TutoringSession 的 Messages
    const sessions = await prisma.tutoringSession.findMany({ where: { userId: { in: studentIds } }, select: { id: true } })
    const sessionIds = sessions.map(s => s.id)
    if (sessionIds.length > 0) {
      await prisma.chatMessage.deleteMany({ where: { sessionId: { in: sessionIds } } })
      await prisma.tutoringSession.deleteMany({ where: { id: { in: sessionIds } } })
    }

    // 1.2 删除学生的错题记录
    await prisma.mistakeRecord.deleteMany({ where: { userId: { in: studentIds } } })

    // 1.3 删除学生的 AppUpload 记录
    await prisma.appUpload.deleteMany({ where: { userId: { in: studentIds } } })

    // 1.4 删除学生的掌握节点记录
    await prisma.userMasteredNode.deleteMany({ where: { userId: { in: studentIds } } })

    // 1.5 删除学生的练习提交记录
    await prisma.exerciseSubmission.deleteMany({ where: { studentId: { in: studentIds } } })
  }

  if (exerciseIds.length > 0) {
    // 2.1 删除班级练习关联的提交记录 (有些提交可能来自已经被删的学生，以防万一再删一次基于 exerciseId 的)
    await prisma.exerciseSubmission.deleteMany({ where: { exerciseId: { in: exerciseIds } } })
    
    // 2.2 删除班级的练习记录
    await prisma.exercise.deleteMany({ where: { classId: id } })
  }

  // 3. 删除班级下的所有学生
  if (studentIds.length > 0) {
    await prisma.user.deleteMany({ where: { classId: id } })
  }

  // 4. 最后删除班级本身
  await prisma.class.delete({
    where: { id }
  })
  
  return NextResponse.json({ success: true })
}

