import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const version = searchParams.get('version') || 'zhejiang'
    const grade = searchParams.get('grade') || '7a'

    const dataDir = path.join(process.cwd(), 'src/data')
    const filePath = path.join(dataDir, `${version}-${grade}.json`)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: '知识图谱数据不存在' }, { status: 404 })
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)

    return NextResponse.json(data.nodes)
  } catch (error) {
    console.error('Get knowledge tree error:', error)
    return NextResponse.json({ error: '获取知识图谱失败' }, { status: 500 })
  }
}
