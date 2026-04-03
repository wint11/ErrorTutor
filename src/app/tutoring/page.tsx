'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, Input, Button, Steps, Typography, Tag, message, Radio, Space, Slider, Switch } from 'antd'
import { RobotOutlined, SendOutlined, AimOutlined, BulbOutlined, HistoryOutlined, SettingOutlined } from '@ant-design/icons'
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
  const [questionCount, setQuestionCount] = useState(5)
  const [difficulty, setDifficulty] = useState('中等')
  const [timeLimit, setTimeLimit] = useState(false)
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

  const handleStartTutoring = async () => {
    setLoading(true)
    
    // 根据用户选择的参数生成辅导提示语或模拟第一道题目
    const totalMinutes = questionCount * (difficulty === '基础' ? 3 : difficulty === '中等' ? 5 : 8)
    const initialProblemText = `根据您选择的【${mode}】模式，系统已为您生成 ${questionCount} 道【${difficulty}】难度的专属题目。${timeLimit ? `\n\n🕒 已开启限时挑战，倒计时 ${totalMinutes} 分钟，请注意时间！` : ''}\n\n请看第一题：\n一辆汽车从甲地开往乙地，若每小时行40千米，则迟到1小时；若每小时行50千米，则早到1小时。求甲乙两地的距离？`
    
    try {
      const res: any = await tutoringApi.createSession(initialProblemText, mode, timeLimit ? totalMinutes : undefined)
      setSessionId(res.data.id)
      setProblemText(initialProblemText)
      setChatHistory(res.data.messages || [{
        id: '1',
        role: 'ai',
        text: `你好！我是你的AI数学导师。针对这套【${mode}】练习，我们先来看第一题。\n\n首先，请你告诉我，你觉得这道题的已知条件是什么？所求又是什么？`
      }])
      setIsProblemSet(true)
      router.push(`/tutoring/${res.data.id}`)
    } catch (error: any) {
      message.error(error.response?.data?.error || '开启会话失败')
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

  const renderSetupView = () => {
    const modes = [
      { value: '通用辅导', icon: <RobotOutlined />, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', desc: '标准步骤解析' },
      { value: '查漏补缺', icon: <AimOutlined />, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: '定位薄弱知识点' },
      { value: '错题复习', icon: <HistoryOutlined />, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', desc: '引导回顾易错点' },
      { value: '专项突破', icon: <BulbOutlined />, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', desc: '深度变式挑战' },
    ]

    return (
      <div className="w-full flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto min-h-[640px] items-stretch">
        {/* 左侧：选择模式 */}
        <div className="w-full lg:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            <h2 className="text-lg font-bold text-slate-800 m-0">第一步：选择辅导模式</h2>
          </div>
          <div className="p-4 flex-grow flex flex-col gap-4 overflow-y-auto">
            {modes.map((m) => (
              <div
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center flex-1 min-h-[100px] ${
                  mode === m.value
                    ? `${m.border} ${m.bg} shadow-md scale-[1.02] z-10`
                    : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={`text-2xl mb-1 ${m.color}`}>{m.icon}</div>
                <div className="font-bold text-slate-800">{m.value}</div>
                <div className="text-xs text-slate-500 mt-1 text-center">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：配置辅导参数 */}
        <div className="w-full lg:w-2/3 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            <h2 className="text-lg font-bold text-slate-800 m-0">第二步：配置辅导参数</h2>
          </div>
          <div className="flex-grow flex flex-col p-6 overflow-hidden">
            <div className="flex-grow flex flex-col gap-8 pr-2 overflow-y-auto">
              
              {/* 参数1：练习题量 */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-slate-800 m-0 flex items-center">
                    <span className="w-2 h-6 bg-blue-500 rounded-full mr-2"></span>
                    目标练习题量
                  </h3>
                  <Tag color="blue" className="text-sm px-3 py-1 rounded-full border-blue-200">
                    {questionCount} 道题
                  </Tag>
                </div>
                <div className="px-4">
                  <Slider 
                    min={1} 
                    max={20} 
                    marks={{ 1: '1道', 5: '5道', 10: '10道', 20: '20道' }}
                    value={questionCount} 
                    onChange={setQuestionCount}
                    tooltip={{ formatter: (val) => `${val} 道题目` }}
                  />
                </div>
                <p className="text-sm text-slate-500 mt-4 text-center">
                  建议单次练习 3-5 道题，保持专注效果最佳
                </p>
              </div>

              {/* 参数2：难度偏好 */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-slate-800 m-0 flex items-center">
                    <span className="w-2 h-6 bg-purple-500 rounded-full mr-2"></span>
                    生成题目难度
                  </h3>
                </div>
                <Radio.Group 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value)} 
                  className="w-full flex gap-4"
                >
                  <Radio.Button value="基础" className="flex-1 text-center h-12 leading-[46px] rounded-lg">基础巩固</Radio.Button>
                  <Radio.Button value="中等" className="flex-1 text-center h-12 leading-[46px] rounded-lg">综合提升</Radio.Button>
                  <Radio.Button value="困难" className="flex-1 text-center h-12 leading-[46px] rounded-lg">拔高挑战</Radio.Button>
                </Radio.Group>
              </div>

              {/* 参数3：附加设置 */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 m-0 flex items-center mb-1">
                    <SettingOutlined className="text-slate-500 mr-2" />
                    开启限时挑战
                  </h3>
                  <p className="text-sm text-slate-500 m-0">系统将根据题量自动分发倒计时，模拟考试压力</p>
                </div>
                <Switch checked={timeLimit} onChange={setTimeLimit} />
              </div>

            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 flex-shrink-0">
              <div className="mb-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between transition-all duration-300">
                <div className="flex flex-col">
                  <span className="text-sm text-blue-600 font-bold mb-1">当前学习计划：</span>
                  <span className="text-base text-slate-800 font-medium">
                    【{mode}】模式 · {questionCount}道{difficulty}题 {timeLimit && '· 限时'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block mb-1">预计耗时</span>
                  <span className="text-xl font-bold text-blue-600">{questionCount * (difficulty === '基础' ? 3 : difficulty === '中等' ? 5 : 8)} 分钟</span>
                </div>
              </div>
              <Button
                type="primary"
                size="large"
                onClick={handleStartTutoring}
                loading={loading}
                className="w-full h-14 text-lg font-bold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 flex items-center justify-center transition-transform hover:-translate-y-0.5"
              >
                生成专属练习并开始 <RobotOutlined className="ml-2 text-xl" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderChatView = () => (
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
              direction="vertical"
              current={currentStep}
              items={[
                { title: '理解题意', description: '提取已知条件和所求' },
                { title: '知识点映射', description: '关联核心数学概念' },
                { title: '逻辑建模', description: '寻找等量关系' },
                { title: '求解验算', description: '计算过程' },
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
              placeholder="输入你的想法或答案..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onPressEnter={handleSendChat}
              disabled={loading}
              className="rounded-xl h-12"
            />
            <Button 
              type="primary" 
              size="large" 
              icon={<SendOutlined />} 
              onClick={handleSendChat}
              disabled={loading}
              className="rounded-xl px-8 h-12 font-bold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
            >
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-full flex-1 py-4 md:py-6 flex flex-col">
      {!isProblemSet ? renderSetupView() : renderChatView()}
    </div>
  )
}
