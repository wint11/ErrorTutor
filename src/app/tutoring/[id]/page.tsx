'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Input, Button, Steps, Typography, Tag, message, Space, Statistic } from 'antd'
import { RobotOutlined, SendOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useParams, useRouter } from 'next/navigation'
import { tutoringApi } from '@/lib/api'

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
  const [loading, setLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  
  const [timeLimit, setTimeLimit] = useState<number | null>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [isTimeUp, setIsTimeUp] = useState(false)

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
      const res: any = await tutoringApi.getSession(sid)
      setProblemText(res.data.problemText)
      setCurrentStep(res.data.currentStep)
      setMode(res.data.mode || '通用辅导')
      
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

  const handleSendChat = async () => {
    if (!chatInput.trim() || !sessionId) return

    const userText = chatInput
    setChatInput('')
    
    const tempUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: userText }
    setChatHistory(prev => [...prev, tempUserMsg])
    setLoading(true)

    try {
      const res: any = await tutoringApi.sendMessage(sessionId, userText)
      setChatHistory(prev => [...prev, res.data])
      setCurrentStep(res.data.currentStep || currentStep)
    } catch (error: any) {
      message.error('发送失败，请重试')
      setChatHistory(prev => prev.filter(msg => msg.id !== tempUserMsg.id))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full flex-1 py-4 md:py-6 flex flex-col">
      <div className="w-full h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
        {/* 左侧：题目与进度 */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 h-full">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 m-0">当前题目</h3>
            </div>
            <div className="p-4 flex-grow overflow-y-auto max-h-[250px]">
              <Paragraph className="text-base leading-relaxed text-slate-700 m-0">{problemText}</Paragraph>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <Space>
                <Tag color="blue" className="rounded-full px-3 py-1">中学数学</Tag>
                <Tag color="purple" className="rounded-full px-3 py-1">{mode}</Tag>
              </Space>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hidden lg:flex flex-col flex-grow">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 m-0">解题进度</h3>
            </div>
            <div className="p-6 flex-grow overflow-y-auto">
              <Steps
                orientation="vertical"
                current={currentStep}
                items={[
                  { title: '理解题意', content: '提取已知条件和所求' },
                  { title: '知识点映射', content: '关联核心数学概念' },
                  { title: '逻辑建模', content: '寻找等量关系' },
                  { title: '求解验算', content: '计算过程' },
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
                <Statistic.Countdown 
                  value={deadline} 
                  onFinish={() => setIsTimeUp(true)}
                  valueStyle={{ fontSize: '16px', fontWeight: 'bold', color: '#ef4444' }}
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
            {chatHistory.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0 mt-1">
                    <RobotOutlined className="text-blue-600" />
                  </div>
                )}
                <div 
                  className={`max-w-[80%] p-4 rounded-2xl shadow-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex gap-3 max-w-4xl mx-auto">
              <Input 
                size="large" 
                placeholder={isTimeUp ? "限时已结束，已锁定输入" : "输入你的想法或答案..."} 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={handleSendChat}
                disabled={loading || isTimeUp}
                className="rounded-xl h-12"
              />
              <Button 
                type="primary" 
                size="large" 
                icon={<SendOutlined />} 
                onClick={handleSendChat}
                disabled={loading || isTimeUp}
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
