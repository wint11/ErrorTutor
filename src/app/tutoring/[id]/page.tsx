'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Input, Button, Steps, Typography, Tag, message, Space, Statistic } from 'antd'
import { RobotOutlined, SendOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useParams, useRouter } from 'next/navigation'
import { tutoringApi } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'

const { Paragraph } = Typography

interface ChatMessage {
  id: string
  role: 'ai' | 'user'
  text: string
}

export default function TutoringSession() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  
  const [currentStep, setCurrentStep] = useState(0)
  const [problemText, setProblemText] = useState('')
  const [mode, setMode] = useState('通用辅导')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupSessions, setGroupSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  
  const [timeLimit, setTimeLimit] = useState<number | null>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [isTimeUp, setIsTimeUp] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId)
    }
  }, [sessionId])

  const loadSession = async (sid: string) => {
    try {
      setProblemText('加载中...')
      let res: any = await tutoringApi.getSession(sid)
      
      if (res.data.status === 'PENDING') {
        setProblemText('题目生成中，请稍候...')
        message.loading({ content: '正在为您生成专属题目...', key: 'generating' })
        res = await tutoringApi.startSession(sid)
        message.success({ content: '生成成功！', key: 'generating' })
      }
      
      setProblemText(res.data.problemText)
      setCurrentStep(res.data.currentStep)
      setMode(res.data.mode || '通用辅导')
      setGroupId(res.data.groupId)
      setIsCompleted(res.data.status === 'COMPLETED' || res.data.currentStep >= 4)
      
      if (res.data.groupId) {
        const groupRes: any = await tutoringApi.getGroupSessions(res.data.groupId)
        setGroupSessions(groupRes.data || [])
      } else {
        setGroupSessions([res.data]) // 如果没有groupId，当前就是唯一题目
      }
      
      if (res.data.timeLimit) {
        setTimeLimit(res.data.timeLimit)
        // 假设创建会话即为开始时间
        const startTime = new Date(res.data.createdAt || Date.now()).getTime()
        setDeadline(startTime + res.data.timeLimit * 60 * 1000)
      }
      
      const messagesRes: any = await tutoringApi.getMessages(sid)
      setChatHistory(messagesRes.data || [])
    } catch (error: any) {
      message.error('加载会话失败')
      router.push('/tutoring')
    }
  }

  const handleSendChat = async (overrideText?: string) => {
    const textToSend = typeof overrideText === 'string' ? overrideText : chatInput
    if (!textToSend.trim() || !sessionId) return

    setChatInput('')
    
    const tempUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textToSend }
    setChatHistory(prev => [...prev, tempUserMsg])
    setLoading(true)

    // 创建一个占位的 AI 回复消息，后续流式更新其文本
    const aiMsgId = (Date.now() + 1).toString()
    setChatHistory(prev => [...prev, { id: aiMsgId, role: 'ai', text: '' }])

    try {
      const response = await tutoringApi.sendMessage(sessionId, textToSend)
      
      if (!response.body) {
        throw new Error('流数据不可用')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aiText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line) continue
          try {
            const data = JSON.parse(line)
            if (data.type === 'text') {
              aiText += data.content
              setChatHistory(prev => prev.map(msg => 
                msg.id === aiMsgId ? { ...msg, text: aiText } : msg
              ))
              
              // 实时解析新题目，如果发现新题目则更新左上角状态
              const newProblemMatch = aiText.match(/<new_problem>([\s\S]*?)<\/new_problem>/)
              if (newProblemMatch) {
                // 如果发现有新题标签，说明后端已经创建了新的session
                // 这里只做标记，在stream结束后再跳转，避免频繁请求
              }
            } else if (data.type === 'meta') {
              if (data.currentStep !== undefined) {
                setCurrentStep(data.currentStep)
              }
              if (data.isCompleted) {
                setIsCompleted(true)
              }
            }
          } catch (e) {
            // console.warn('解析错误或非JSON行', line)
          }
        }
      }

      const newProblemMatch = aiText.match(/<new_problem>([\s\S]*?)<\/new_problem>/)
      if (newProblemMatch) {
        try {
          const currentSessionRes: any = await tutoringApi.getSession(sessionId)
          const latestGroupId = currentSessionRes.data.groupId
          if (latestGroupId) {
            const groupRes: any = await tutoringApi.getGroupSessions(latestGroupId)
            const sessions = groupRes.data
            if (sessions && sessions.length > 0) {
              const latestSession = sessions[sessions.length - 1]
              if (latestSession.id !== sessionId) {
                message.success('已为您生成新题目！')
                router.push(`/tutoring/${latestSession.id}`)
              }
            }
          }
        } catch (e) {
          console.error('获取新会话失败', e)
        }
      }
    } catch (error: any) {
      message.error('发送失败，请重试')
      setChatHistory(prev => prev.filter(msg => msg.id !== tempUserMsg.id && msg.id !== aiMsgId))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full flex-1 py-4 md:py-6 flex flex-col">
      <div className="w-full h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
        {/* 左侧：题目与进度 */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 h-full">
          {groupSessions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 m-0">题目列表 ({groupSessions.length})</h3>
              </div>
              <div className="p-4 flex gap-2 flex-wrap max-h-[120px] overflow-y-auto">
                {groupSessions.map((session, idx) => (
                  <Button
                    key={session.id}
                    type={session.id === sessionId ? 'primary' : session.status === 'COMPLETED' ? 'default' : 'dashed'}
                    className={session.id === sessionId ? 'bg-blue-600' : session.status === 'COMPLETED' ? 'border-emerald-400 text-emerald-600' : ''}
                    onClick={() => {
                      if (session.id !== sessionId) {
                        router.push(`/tutoring/${session.id}`)
                      }
                    }}
                  >
                    第 {idx + 1} 题
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-grow">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 m-0">当前题目</h3>
            </div>
            <div className="p-4 flex-grow overflow-y-auto">
              <Paragraph className="text-base leading-relaxed text-slate-700 m-0">{problemText}</Paragraph>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <Space>
                <Tag color="blue" className="rounded-full px-3 py-1">中学数学</Tag>
                <Tag color="purple" className="rounded-full px-3 py-1">{mode}</Tag>
              </Space>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hidden lg:flex flex-col">
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 m-0 text-sm">解题进度</h3>
              <Tag color="blue" className="m-0 border-none bg-blue-50 text-blue-600">{currentStep + 1} / 4</Tag>
            </div>
            <div className="p-4">
              <Steps
                size="small"
                current={currentStep}
                items={[
                  { title: '理解题意' },
                  { title: '知识点映射' },
                  { title: '逻辑建模' },
                  { title: '求解验算' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* 右侧：聊天主界面 */}
        <div className="w-full lg:w-2/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
          <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center text-blue-800 font-bold text-lg">
              <RobotOutlined className="mr-2 text-2xl" />
              AI 专属导师 - {mode}
            </div>
            {deadline && !isTimeUp && (
              <div className="flex items-center bg-white px-4 py-1.5 rounded-full shadow-sm border border-blue-100">
                <ClockCircleOutlined className="text-red-500 mr-2" />
                <Statistic.Timer
                  type="countdown"
                  value={deadline} 
                  onFinish={() => setIsTimeUp(true)}
                  styles={{ content: { fontSize: '16px', fontWeight: 'bold', color: '#ef4444' } }}
                  format="mm:ss"
                />
              </div>
            )}
            {isTimeUp && (
              <Tag color="red" className="m-0 text-sm font-bold py-1 px-3 border-red-200">
                <ClockCircleOutlined className="mr-1" /> 时间到！已锁定输入
              </Tag>
            )}
          </div>
          
          <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-6 bg-slate-50/50">
            {chatHistory.map((msg) => {
              let displayText = msg.text
              let options: string[] = []
              
              if (msg.role === 'ai') {
                const match = displayText.match(/(?:^|\n)快捷选项：(.*)$/)
                if (match) {
                  options = match[1].split('|').map(s => s.trim()).filter(Boolean)
                  displayText = displayText.replace(match[0], '').trim()
                }
                
                // 去除页面显示的 <new_problem> 标签包装
                displayText = displayText.replace(/<\/?new_problem>/g, '')
              }

              return (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0 mt-1">
                      <RobotOutlined className="text-blue-600" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 max-w-[80%] overflow-hidden">
                    <div 
                      className={`p-4 rounded-2xl shadow-sm leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-white text-slate-800 rounded-tr-sm border border-slate-200 whitespace-pre-wrap' 
                          : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200'
                      }`}
                    >
                      <div className="prose prose-sm md:prose-base max-w-none prose-blue prose-p:my-1 prose-pre:my-1">
                        {msg.role === 'user' ? (
                          displayText
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkMath, remarkGfm]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {displayText}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                    {options.length > 0 && !loading && msg.id === chatHistory[chatHistory.length - 1].id && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {options.map((opt, idx) => {
                          if (opt === '学会了') {
                            return (
                              <Button 
                                key={idx} 
                                size="small" 
                                className="rounded-full text-white border-blue-600 bg-blue-600 hover:bg-blue-700"
                                onClick={() => router.push('/tutoring')}
                                disabled={loading || isTimeUp}
                              >
                                {opt}，结束辅导
                              </Button>
                            )
                          }
                          return (
                            <Button 
                              key={idx} 
                              size="small" 
                              className="rounded-full text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                              onClick={() => handleSendChat(opt)}
                              disabled={loading || isTimeUp}
                            >
                              {opt}
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex gap-3 max-w-4xl mx-auto">
              <Input 
                size="large" 
                placeholder={isTimeUp ? "限时已结束，已锁定输入" : "输入你的想法或答案..."} 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={() => handleSendChat()}
                disabled={loading || isTimeUp}
                className="rounded-xl h-12"
              />
              <Button 
                type="primary" 
                size="large" 
                icon={<SendOutlined />} 
                onClick={() => handleSendChat()}
                disabled={loading || isTimeUp || !chatInput.trim()}
                className="rounded-xl px-8 h-12 font-bold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
