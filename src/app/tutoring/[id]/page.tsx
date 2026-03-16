'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Card, Input, Button, Steps, Typography, Tag, message } from 'antd'
import { RobotOutlined, SendOutlined } from '@ant-design/icons'
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
    <div className="w-full flex-1 py-4 md:py-6 flex flex-col h-[calc(100vh-64px)]">
      <div className="w-full h-full flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <Card title="当前题目" className="rounded-xl shadow-sm border-slate-100">
            <div className="max-h-[200px] overflow-y-auto">
              <Paragraph className="text-base leading-relaxed text-slate-700">{problemText}</Paragraph>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Tag color="blue">中学数学</Tag>
              <Tag color="purple">{mode}</Tag>
            </div>
          </Card>

          <Card title="解题进度" className="rounded-xl shadow-sm border-slate-100 hidden lg:block flex-grow">
            <Steps
              direction="vertical"
              current={currentStep}
              items={[
                { title: '理解题意', description: '提取已知条件和所求' },
                { title: '知识点映射', description: '关联核心数学概念' },
                { title: '逻辑建模', description: '寻找等量关系' },
                { title: '求解验算', description: '计算过程' }
              ]}
            />
          </Card>
        </div>

        <Card className="w-full lg:w-2/3 rounded-xl shadow-sm border-slate-100 flex flex-col h-full">
          <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center text-blue-800 font-bold text-lg">
              <RobotOutlined className="mr-2 text-2xl" />
              AI 专属导师 - {mode}
            </div>
          </div>
          
          <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4 bg-slate-50">
            {chatHistory.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-500 text-white rounded-br-sm' 
                      : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex gap-3">
              <Input 
                size="large" 
                placeholder="输入你的想法或答案..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPressEnter={handleSendChat}
                disabled={loading}
                className="rounded-xl"
              />
              <Button 
                type="primary" 
                size="large" 
                icon={<SendOutlined />} 
                onClick={handleSendChat}
                disabled={loading}
                className="rounded-xl px-6 bg-blue-600"
              >
                发送
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
