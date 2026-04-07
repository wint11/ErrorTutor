import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'
import { writeFile } from 'fs/promises'
import { mkdir } from 'fs/promises'
import path from 'path'

const VALID_GRADES = ['elementary', 'junior', 'senior']

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'

function generateQuestionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}${random}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ grade: string }> }
) {
  try {
    const { grade } = await params
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: '未授权或令牌无效' }, { status: 401 })
    }

    if (!VALID_GRADES.includes(grade)) {
      return NextResponse.json({ error: '无效的学段参数' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json({ error: '没有上传文件' }, { status: 400 })
    }

    // 生成题目ID
    const questionId = generateQuestionId()

    // 创建上传目录
    const uploadDir = path.join(process.cwd(), UPLOAD_DIR, 'questions', grade, questionId)
    await mkdir(uploadDir, { recursive: true })

    // 保存文件
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${Date.now()}-${file.name}`
    const filePath = path.join(uploadDir, filename)
    await writeFile(filePath, buffer)

    const fileUrl = `/${UPLOAD_DIR}/questions/${grade}/${questionId}/${filename}`

    // 调用 OCR 服务
    let ocrText = ''
    let ocrLines: string[] = []

    if (OCR_SERVICE_URL) {
      try {
        const ocrFormData = new FormData()
        ocrFormData.append('file', file)

        const ocrResponse = await fetch(`${OCR_SERVICE_URL}/api/v1/ocr/recognize`, {
          method: 'POST',
          body: ocrFormData
        })

        if (ocrResponse.ok) {
          const ocrData = await ocrResponse.json()
          ocrText = ocrData.text || ''
          ocrLines = ocrData.lines || []
        }
      } catch (ocrError) {
        console.error('OCR 识别失败:', ocrError)
      }
    }

    // 保存到数据库
    const rawProblem = await prisma.rawProblem.create({
      data: {
        questionId,
        grade,
        imageUrl: fileUrl,
        ocrText,
        ocrLines: JSON.stringify(ocrLines),
        status: ocrText ? 'completed' : 'pending'
      }
    })

    return NextResponse.json({
      success: true,
      questionId,
      fileUrl,
      ocr: {
        text: ocrText,
        lines: ocrLines
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}
