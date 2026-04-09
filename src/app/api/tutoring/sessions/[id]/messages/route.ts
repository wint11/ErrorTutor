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

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    let peerMistakesContext = ''
    if (user?.classId) {
      // Find mistakes from other students in the same class for this problem
      const peerMistakes = await prisma.mistakeRecord.findMany({
        where: {
          problemText: session.problemText,
          user: { classId: user.classId, id: { not: user.id } }
        },
        take: 3,
        include: { user: { select: { username: true } } }
      })

      if (peerMistakes.length > 0) {
        const peerNames = peerMistakes.map(m => m.user.username).join('、')
        peerMistakesContext = `\n\n【交叉练习与启发引导要求（重要）】\n根据系统检索，当前学生的同班同学（如 ${peerNames}）在这道题上也曾经犯过错。作为 AI 导师，你需要利用这个信息进行“交叉练习”引导：\n在你的回复中，适当地引入同伴的易错点来启发当前学生。例如：“我注意到你们班的 ${peerMistakes[0].user.username} 同学在这个地方也遇到过困难，你觉得他/她当时可能是哪里想错了呢？”或者“这道题你们班有几个同学都掉进了同一个陷阱，你能猜到是什么陷阱吗？”\n请保持自然和鼓励的语气，引导学生不仅自己做对，还能去思考别人为什么会做错。`
      }
    }

    // 判断是否是练习任务的举一反三（练习只允许举一反三一次）
    // 如果 session.exerciseId 存在，说明是原始的练习题，此时允许举一反三一次。
    // 但是如果是举一反三生成的新 session，我们会在创建时把 exerciseId 置空，但它的 groupId 和原练习是一致的。
    // 为了判断“是否是在班级练习任务基础上的衍生”，我们可以检查其初始的 exerciseId。
    // 这里简单的做法：直接通过 session.exerciseId 是否存在来告知 AI 是否是练习，并且我们可以在流处理部分拦截。
    let isExerciseContext = false
    let currentSessionGroupCount = 1

    if (session.groupId) {
      // 检查这个组内是不是来源于某个 exerciseId
      const groupSessions = await prisma.tutoringSession.findMany({
        where: { groupId: session.groupId },
        select: { exerciseId: true }
      })
      const hasExerciseOrigin = groupSessions.some(s => s.exerciseId !== null)
      if (hasExerciseOrigin) {
        isExerciseContext = true
        currentSessionGroupCount = groupSessions.length
      }
    } else if (session.exerciseId) {
      isExerciseContext = true
    }

    // 统计当前会话中学生犯错的次数（基于是否触发了 isMistake 记录，我们可以简单通过消息中的逻辑或者查错题本，
    // 为了实时，可以查询本 session 中是否有未能推进步骤的 user message）
    // 这里我们可以用一个简化的方式：统计该会话期间该知识点记录到 mistake 里的次数，或者直接把刚刚的 isMistake 算进去。
    // 更准确的是：查出当前 session 已经有的错误次数（我们这里用一个大致的估算，或者传给 AI 一个标志）。
    // 假设只要 session 步数进展缓慢，就意味着犯错：
    // 但最直接的，我们可以看看之前有没有在这个 session 中生成过 `MistakeRecord`：
    const mistakesInSession = await prisma.mistakeRecord.count({
      where: {
        userId: payload.userId,
        problemText: session.problemText
      }
    })

    // 如果是练习任务的组，并且已经生成了不止一题（原题 + 1次变式 = 2题），则告诉 AI 不再允许举一反三
    const forbidMoreVariations = isExerciseContext && currentSessionGroupCount >= 2
    let variationLimitContext = ''
    if (forbidMoreVariations) {
      variationLimitContext = `\n\n【重要指令】：当前学生正在完成“班级练习任务”的变式题。系统规定此类练习最多只能“举一反三”一次，现在次数已用尽！如果学生再次要求“举一反三”或“再来一题”，你**必须温和地拒绝**，并告诉他这道练习任务已经圆满完成，请返回首页查看其他任务。绝对不要再输出 <new_problem> 标签！`
    }

    const systemPrompt = PROMPTS.tutoringSystem(session.problemText, session.mode, session.currentStep, isExerciseContext, mistakesInSession + (isMistake ? 1 : 0)) + peerMistakesContext + variationLimitContext

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

            // === 这里处理练习任务闭环 ===
            if (nextStep >= 4 && session.exerciseId) {
              // 找到对应的 exerciseSubmission 并标记为正确/已完成
              await prisma.exerciseSubmission.updateMany({
                where: {
                  exerciseId: session.exerciseId,
                  studentId: payload.userId
                },
                data: {
                  isCorrect: true,
                  content: '已通过 AI 辅导顺利完成练习'
                }
              })
            }
            // =========================

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
