'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, Input, Button, Steps, Typography, Tag, message, Tabs, List, Radio, Space } from 'antd'
import { RobotOutlined, SendOutlined, AimOutlined, BulbOutlined, HistoryOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { tutoringApi } from '@/lib/api'

const { Paragraph, Text } = Typography
const { TextArea } = Input

interface ChatMessage {
  id: string
  role: 'ai' | 'user'
  text: string
}

interface ProblemItem {
  id: string
  problemText?: string
  text?: string
  status?: string
  difficulty?: string
  knowledgePoint?: string
}

export default function Tutoring() {
  const router = useRouter()
  
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [problemText, setProblemText] = useState('')
  const [mode, setMode] = useState('通用辅导')
  const [isProblemSet, setIsProblemSet] = useState(false)
  const [loading, setLoading] = useState(false)

  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  
  const [historyProblems, setHistoryProblems] = useState<ProblemItem[]>([])
  const [recommendProblems, setRecommendProblems] = useState<ProblemItem[]>([])

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => {
    fetchProblemSources()
  }, [])

  const fetchProblemSources = async () => {
    try {
      // 简化处理，实际应该调用相应 API
      setHistoryProblems([])
      setRecommendProblems([])
    } catch (error) {
      console.error('加载题目来源失败', error)
    }
  }

  const handleSetProblem = async () => {
    if (!problemText.trim()) return
    setLoading(true)
    try {
      const res: any = await tutoringApi.createSession(problemText, mode)
      setSessionId(res.data.id)
      setChatHistory(res.data.messages || [{
        id: '1',
        role: 'ai',
        text: `你好！我是你的AI数学导师。我们来一起解决这道题目吧。\n\n题目：${problemText}\n\n首先，请你告诉我，你觉得这道题的已知条件是什么？所求又是什么？`
      }])
      setIsProblemSet(true)
      router.push(`/tutoring/${res.data.id}`)
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建会话失败')
    } finally {
      setLoading(false)
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

  const renderSetupView = () => (
    <div className="w-full h-auto lg:h-full flex flex-col lg:flex-row gap-6">
      <Card title="第一步：选择辅导模式" className="rounded-xl shadow-sm border-slate-100 flex-shrink-0 lg:w-1/3 flex flex-col h-auto lg:h-full">
        <Radio.Group onChange={(e) => setMode(e.target.value)} value={mode} className="w-full flex-grow flex flex-col">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            <Radio.Button value="通用辅导" className="h-full min-h-[80px] p-4 rounded-xl text-center border-slate-200 flex flex-col items-center justify-center">
              <div className="text-xl mb-2 text-blue-500"><RobotOutlined /></div>
              <div className="font-bold">通用辅导</div>
              <div className="text-xs text-slate-500 mt-1">标准步骤解析</div>
            </Radio.Button>
            <Radio.Button value="查漏补缺" className="h-full min-h-[80px] p-4 rounded-xl text-center border-slate-200 flex flex-col items-center justify-center">
              <div className="text-xl mb-2 text-emerald-500"><AimOutlined /></div>
              <div className="font-bold">查漏补缺</div>
              <div className="text-xs text-slate-500 mt-1">定位薄弱知识点</div>
            </Radio.Button>
            <Radio.Button value="错题复习" className="h-full min-h-[80px] p-4 rounded-xl text-center border-slate-200 flex flex-col items-center justify-center">
              <div className="text-xl mb-2 text-rose-500"><HistoryOutlined /></div>
              <div className="font-bold">错题复习</div>
              <div className="text-xs text-slate-500 mt-1">引导回顾易错点</div>
            </Radio.Button>
            <Radio.Button value="专项突破" className="h-full min-h-[80px] p-4 rounded-xl text-center border-slate-200 flex flex-col items-center justify-center">
              <div className="text-xl mb-2 text-amber-500"><BulbOutlined /></div>
              <div className="font-bold">专项突破</div>
              <div className="text-xs text-slate-500 mt-1">深度变式挑战</div>
            </Radio.Button>
          </div>
        </Radio.Group>
      </Card>

      <Card title="第二步：选择或录入题目" className="rounded-xl shadow-sm border-slate-100 flex-grow flex flex-col min-h-[500px] lg:h-full">
        <Tabs
          defaultActiveKey="manual"
          className="flex-grow flex flex-col"
          items={[
            {
              key: 'history',
              label: '📱 历史上传',
              children: (
                <div className="h-[300px] overflow-y-auto">
                  <List
                    dataSource={historyProblems}
                    renderItem={item => (
                      <List.Item 
                        className="cursor-pointer hover:bg-slate-50 transition-colors px-4 rounded-lg"
                        onClick={() => setProblemText(item.problemText || '')}
                      >
                        <List.Item.Meta
                          title={<Text className="text-slate-800">{item.problemText}</Text>}
                          description={<Tag color="blue">{item.status}</Tag>}
                        />
                      </List.Item>
                    )}
                    locale={{ emptyText: '暂无上传记录' }}
                  />
                </div>
              )
            },
            {
              key: 'recommend',
              label: '💡 智能推荐',
              children: (
                <div className="h-[300px] overflow-y-auto">
                  <List
                    dataSource={recommendProblems}
                    renderItem={item => (
                      <List.Item 
                        className="cursor-pointer hover:bg-slate-50 transition-colors px-4 rounded-lg"
                        onClick={() => setProblemText(item.text || '')}
                      >
                        <List.Item.Meta
                          title={<Text className="text-slate-800">{item.text}</Text>}
                          description={
                            <Space>
                              <Tag color="cyan">{item.knowledgePoint}</Tag>
                              <Tag color="purple">{item.difficulty}</Tag>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                    locale={{ emptyText: '暂无推荐题目' }}
                  />
                </div>
              )
            },
            {
              key: 'manual',
              label: '⌨️ 手动录入',
              children: (
                <TextArea 
                  placeholder="请在此粘贴或输入中学数学题目..." 
                  value={problemText}
                  onChange={(e) => setProblemText(e.target.value)}
                  className="text-lg p-4 resize-none h-[300px]"
                />
              )
            }
          ]}
        />
        
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">已选题目：</div>
            {problemText ? (
              <div className="text-base text-slate-800 font-medium line-clamp-3">{problemText}</div>
            ) : (
              <div className="text-base text-slate-400">暂未选择或输入题目</div>
            )}
          </div>
          <Button 
            type="primary" 
            size="large" 
            onClick={handleSetProblem} 
            disabled={!problemText.trim()} 
            loading={loading}
            className="w-full h-12 text-lg rounded-xl bg-blue-600"
          >
            开启智能辅导
          </Button>
        </div>
      </Card>
    </div>
  )

  const renderChatView = () => (
    <div className="w-full h-auto lg:h-full flex flex-col lg:flex-row gap-6">
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

      <Card className="w-full lg:w-2/3 rounded-xl shadow-sm border-slate-100 flex flex-col h-[600px] lg:h-full">
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
  )

  return (
    <div className="w-full flex-1 py-4 md:py-6 flex flex-col">
      {!isProblemSet ? renderSetupView() : renderChatView()}
    </div>
  )
}
