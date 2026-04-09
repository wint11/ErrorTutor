import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload, hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { classId, count } = await request.json()
  if (!classId || !count || count < 1 || count > 100) {
    return NextResponse.json({ error: '参数错误，数量需在1-100之间' }, { status: 400 })
  }

  const classObj = await prisma.class.findUnique({ where: { id: classId } })
  if (classObj?.teacherId !== user.id) {
    return NextResponse.json({ error: '班级不存在或无权限' }, { status: 403 })
  }

  const results = []

  for (let i = 0; i < count; i++) {
    const username = 'stu_' + Math.random().toString(36).substring(2, 8)
    const plainPassword = '123456'
    const hashedPassword = await hashPassword(plainPassword)
    
    try {
      const newStu = await prisma.user.create({
        data: {
          username: username,
          password: hashedPassword,
          role: 'STUDENT',
          classId: classId,
          requirePasswordChange: true
          // 学生的学力、年级等信息将由学生在登录时自行完善
        }
      })
      results.push({ username: newStu.username, password: plainPassword })
    } catch (e: any) {
      console.error('Create student error:', e)
    }
  }

  return NextResponse.json({ success: true, created: results.length, results })
}

export async function DELETE(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { studentId } = await request.json()
  if (!studentId) {
    return NextResponse.json({ error: '缺少学生ID' }, { status: 400 })
  }

  // 验证该学生是否属于该教师的班级
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { class: true }
  })

  if (!student || student.class?.teacherId !== user.id) {
    return NextResponse.json({ error: '学生不存在或无权限删除' }, { status: 403 })
  }

  await prisma.user.delete({ where: { id: studentId } })

  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const classId = request.nextUrl.searchParams.get('classId')
  
  let whereClause: any = { role: 'STUDENT', class: { teacherId: user.id } }
  if (classId) {
    whereClause.classId = classId
  }

  const students = await prisma.user.findMany({
    where: whereClause,
    select: { id: true, username: true, grade: true, level: true, class: { select: { name: true } }, createdAt: true },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(students)
}

export async function PUT(request: NextRequest) {
  const payload = getAuthPayload(request)
  if (!payload) return NextResponse.json({ error: '未登录' }, { status: 401 })
  
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (user?.role !== 'TEACHER') return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { studentId, username, password, classId } = await request.json()
  if (!studentId) {
    return NextResponse.json({ error: '缺少学生ID' }, { status: 400 })
  }

  // 验证该学生是否属于该教师的班级
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { class: true }
  })

  if (!student || student.class?.teacherId !== user.id) {
    return NextResponse.json({ error: '学生不存在或无权限修改' }, { status: 403 })
  }

  let updateData: any = {}
  if (username) updateData.username = username
  if (classId) updateData.classId = classId
  
  if (password) {
    updateData.password = await hashPassword(password)
    updateData.requirePasswordChange = false // 教师手动修改后不强制要求学生修改
  }

  try {
    const updatedStudent = await prisma.user.update({
      where: { id: studentId },
      data: updateData,
      select: { id: true, username: true, class: { select: { name: true } } }
    })
    return NextResponse.json({ success: true, student: updatedStudent })
  } catch (error: any) {
    // 检查用户名是否重复
    if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 400 })
    }
    console.error('Update student error:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}
