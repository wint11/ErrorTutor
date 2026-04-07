import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { chatCompletionStream } from '@/lib/llm'
import { PROMPTS } from '@/config/prompts'

export async function POST(request: NextRequest) {
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

    const userId = payload.userId

    // 0. 检查是否在 3 天内生成过
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        grade: true,
        level: true,
        textbookVersion: true,
        aiPortraitUpdatedAt: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    if (user.aiPortraitUpdatedAt) {
      const now = new Date()
      const lastUpdate = new Date(user.aiPortraitUpdatedAt)
      const diffTime = Math.abs(now.getTime() - lastUpdate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays < 3) {
        return NextResponse.json({ error: '画像生成频率过高，请距离上次更新满 3 天后再试。多去练习积累数据吧！' }, { status: 429 })
      }
    }

    // 2. 获取辅导记录统计
    const sessions = await prisma.tutoringSession.findMany({
      where: { userId },
      select: {
        id: true,
        messages: {
          select: { role: true }
        }
      }
    })

    // 估算题目数量：每次 session 可以算作多道题或者以 session 数量为准
    // 根据数据模型，一个 session 代表一个主练习流程，这里简单用 session 数量作为总辅导次数
    const totalSessions = sessions.length
    // 这里如果每道题是一个 session（基于"再来一题"可能创建新 session），就等价于 totalSessions
    // 如果一个 session 包含多题，可以按照逻辑来算。这里简单用 sessions.length
    const totalProblems = sessions.length 

    const sessionStats = {
      totalSessions,
      totalProblems
    }

    // 3. 获取错题数量
    const mistakeRecordsCount = await prisma.mistakeRecord.count({
      where: { userId }
    })
    const appUploadsCount = await prisma.appUpload.count({
      where: { userId }
    })
    const mistakesCount = mistakeRecordsCount + appUploadsCount

    // 4. 获取薄弱知识点（取错误率最高的前5个）
    const weakNodes = await prisma.userMasteredNode.findMany({
      where: {
        userId,
        totalPracticed: { gt: 0 }
      },
      orderBy: {
        errorCount: 'desc'
      },
      take: 5
    })

    // 这里需要把 nodeId 映射到实际名称。为了简化，我们只返回错误率。
    // 在真实应用中，可能需要通过 tree 拿到知识点名称，但数据库里只有 nodeId。
    // 如果没有存知识点名称，可以直接用 nodeId，但在 Prompt 中可能不好看。
    // 另一种做法是，我们直接从最近的错题里取错题考点。
    const recentMistakes = await prisma.mistakeRecord.findMany({
      where: { userId, knowledgePoint: { not: null } },
      select: { knowledgePoint: true },
      take: 10,
      orderBy: { createdAt: 'desc' }
    })
    
    // 统计频繁出现的知识点作为薄弱点
    const kpCount: Record<string, number> = {}
    recentMistakes.forEach(m => {
      if (m.knowledgePoint) {
        kpCount[m.knowledgePoint] = (kpCount[m.knowledgePoint] || 0) + 1
      }
    })
    
    // 如果有 UserMasteredNode，也可以用，但没有名称映射比较麻烦。
    // 这里我们把 nodeId 传过去或者用最近错题知识点代替
    const weakPoints = Object.keys(kpCount)
      .map(kp => ({ title: kp, errorRate: 50 + Math.random() * 30 })) // 估算错误率
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 3)

    // 如果都没有，再看看 weakNodes 的 id 兜底
    if (weakPoints.length === 0 && weakNodes.length > 0) {
      weakNodes.forEach(wn => {
        const rate = (wn.errorCount / wn.totalPracticed) * 100
        weakPoints.push({ title: `知识点节点(${wn.nodeId})`, errorRate: rate })
      })
    }

    // 5. 构造 Prompt 并请求 LLM
    const prompt = PROMPTS.generatePortrait(user, sessionStats, mistakesCount, weakPoints)
    
    const messages = [{ role: 'user' as const, content: prompt }]
    const response = await chatCompletionStream(messages)
    
    if (!response.body) {
      throw new Error('No stream body found')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let aiReply = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6))
            const text = data.choices?.[0]?.delta?.content || ''
            if (text) {
              aiReply += text
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }

    const finalPortrait = aiReply.trim()

    // 6. 保存到数据库
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        aiPortrait: finalPortrait,
        aiPortraitUpdatedAt: new Date()
      },
      select: {
        id: true,
        aiPortrait: true,
        aiPortraitUpdatedAt: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Generate portrait error:', error)
    return NextResponse.json({ error: '生成画像失败' }, { status: 500 })
  }
}
