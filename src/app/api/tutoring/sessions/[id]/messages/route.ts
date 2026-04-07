import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthPayload } from '@/lib/auth'
import { chatCompletionStream } from '@/lib/llm'
import { PROMPTS } from '@/config/prompts'
import { getNodeIdByTitle } from '@/lib/knowledge'

const STEP_TITLES = ['理解题意', '知识点映射', '逻辑建模', '求解验算']

function normalizeText(text: string) {
  return text.replace(/\s+/g, '')
}

function inferNextStep(userText: string, currentStep: number) {
  const normalized = normalizeText(userText)

  if (!normalized) {
    return currentStep
  }

  const hasKnownAndUnknown =
    /(已知|知道|条件|速度|时间|路程|甲地|乙地)/.test(normalized) &&
    /(求|所求|问题|未知)/.test(normalized)
  const hasKnowledgePoint =
    /(方程|一元一次|路程|速度|时间|数量关系|等量关系|公式)/.test(normalized)
  const hasEquation =
    /(设|令|x|y|=|40|50|\+|-|×|÷|\*|\/)/.test(normalized)
  const hasConclusion =
    /(答案|结果|所以|因此|检验|验算|符合题意)/.test(normalized)

  if (currentStep <= 0 && hasKnownAndUnknown) {
    return 1
  }

  if (currentStep <= 1 && hasKnowledgePoint) {
    return Math.max(currentStep, 2)
  }

  if (currentStep <= 2 && hasEquation) {
    return Math.max(currentStep, 3)
  }

  if (currentStep >= 3 && hasConclusion) {
    return 4
  }

  return currentStep
}

// 获取会话消息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: '未授权或令牌无效' }, { status: 401 })
    }

    const session = await prisma.tutoringSession.findUnique({
      where: { id }
    })

    if (!session || session.userId !== payload.userId) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 })
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json({ error: '获取消息失败' }, { status: 500 })
  }
}

// 发送消息
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payload = getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: '未授权或令牌无效' }, { status: 401 })
    }

    const { text } = await request.json()
    const trimmedText = typeof text === 'string' ? text.trim() : ''

    if (!trimmedText) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 })
    }

    const session = await prisma.tutoringSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    })

    if (!session || session.userId !== payload.userId) {
      return NextResponse.json({ error: '会话不可用' }, { status: 404 })
    }

    // 保存用户消息
    await prisma.chatMessage.create({
      data: {
        sessionId: id,
        role: 'user',
        text: trimmedText
      }
    })

    // 推断下一步
    const nextStep = inferNextStep(trimmedText, session.currentStep)
    
    // 如果用户回答没有推进步骤，或者 AI 认为答错了，这属于一次“犯错”
    const isMistake = nextStep === session.currentStep && session.currentStep < 4
    
    // 异步记录错误和练习次数
    if (session.knowledgePoint) {
      const nodeId = getNodeIdByTitle(session.knowledgePoint)
      if (nodeId) {
        await prisma.userMasteredNode.upsert({
          where: {
            userId_nodeId: {
              userId: payload.userId,
              nodeId: nodeId
            }
          },
          update: {
            errorCount: { increment: isMistake ? 1 : 0 },
            totalPracticed: { increment: 1 }
          },
          create: {
            userId: payload.userId,
            nodeId,
            errorCount: isMistake ? 1 : 0,
            totalPracticed: 1
          }
        })
        
        // 如果是错误，顺便记录到错题本中
        if (isMistake) {
          // 为了防止同一题反复记错题，先检查一下是否已经有了这道题的未复习记录
          const existingMistake = await prisma.mistakeRecord.findFirst({
            where: {
              userId: payload.userId,
              problemText: session.problemText,
              status: '待复习'
            }
          })
          
          if (!existingMistake) {
            await prisma.mistakeRecord.create({
              data: {
                userId: payload.userId,
                problemText: session.problemText,
                errorType: '逻辑/计算错误',
                knowledgePoint: session.knowledgePoint,
                status: '待复习'
              }
            })
          }
        }
      }
    }

    const systemPrompt = PROMPTS.tutoringSystem(session.problemText, session.mode, session.currentStep)

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...session.messages.map((message) => ({
        role: message.role === 'ai' ? 'assistant' as const : 'user' as const,
        content: message.text
      })),
      { role: 'user' as const, content: trimmedText }
    ]

    const response = await chatCompletionStream(messages)

    if (!response.body) {
      throw new Error('No stream body found')
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        let aiReply = ''
        
        // 发送步骤信息和provider
        controller.enqueue(encoder.encode(JSON.stringify({ 
          type: 'meta', 
          currentStep: nextStep,
          provider: process.env.LLM_PROVIDER || 'deepseek',
          isCompleted: nextStep >= 4
        }) + '\n'))

        const reader = response.body!.getReader()

        try {
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
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'text', content: text }) + '\n'))
                  }
                } catch (e) {
                  console.warn('解析流数据错误', e)
                }
              }
            }
          }

          // 流结束后保存消息
          const newProblemMatch = aiReply.match(/<new_problem>([\s\S]*?)<\/new_problem>/)
          
          if (newProblemMatch) {
            // 如果AI生成了新题（举一反三），则不再覆盖当前session，而是新建一个session放入同一个group
            let finalProblemText = newProblemMatch[1].trim()
            let newKnowledgePoint = session.knowledgePoint
            
            const kpMatch = finalProblemText.match(/<knowledge>([\s\S]*?)<\/knowledge>/)
            if (kpMatch) {
              newKnowledgePoint = kpMatch[1].trim()
              finalProblemText = finalProblemText.replace(/<knowledge>[\s\S]*?<\/knowledge>/g, '').trim()
            }
            
            // 将当前 session 标记为完成
            await prisma.tutoringSession.update({
              where: { id },
              data: {
                currentStep: 4,
                status: 'COMPLETED'
              }
            })
            
            let finalGroupId = session.groupId
            if (!finalGroupId) {
              finalGroupId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
              // 更新旧的session，赋予groupId
              await prisma.tutoringSession.update({
                where: { id },
                data: { groupId: finalGroupId }
              })
            }

            // 创建新 session
            const newSession = await prisma.tutoringSession.create({
              data: {
                userId: session.userId,
                groupId: finalGroupId,
                problemText: finalProblemText,
                knowledgePoint: newKnowledgePoint,
                mode: session.mode,
                difficulty: session.difficulty,
                status: 'IN_PROGRESS',
                currentStep: 0,
                timeLimit: session.timeLimit
              }
            })

            // 创建新 session 的初始 AI 消息
            await prisma.chatMessage.create({
              data: {
                sessionId: newSession.id,
                role: 'ai',
                text: `这是一道相似的题目，我们来一起看看：\n\n题目：${finalProblemText}\n\n首先，请你告诉我，你觉得这道题的已知条件是什么？所求又是什么？`
              }
            })

            // 保存当前会话的回复（去掉新题部分）
            const replyWithoutProblem = aiReply.replace(/<new_problem>[\s\S]*?<\/new_problem>/, '').trim()
            if (replyWithoutProblem) {
              await prisma.chatMessage.create({
                data: {
                  sessionId: id,
                  role: 'ai',
                  text: replyWithoutProblem
                }
              })
            }
          } else {
            // 正常更新当前 session
            await prisma.tutoringSession.update({
              where: { id },
              data: {
                currentStep: nextStep,
                status: nextStep >= 4 ? 'COMPLETED' : 'IN_PROGRESS'
              }
            })

            await prisma.chatMessage.create({
              data: {
                sessionId: id,
                role: 'ai',
                text: aiReply
              }
            })
          }
          
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '发送消息失败' }, { status: 500 })
  }
}
