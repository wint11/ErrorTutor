'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, Input, Button, Steps, Typography, Tag, message, Radio, Space, Slider, Switch, Select, Spin, Empty } from 'antd'
import { RobotOutlined, SendOutlined, AimOutlined, BulbOutlined, HistoryOutlined, SettingOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { tutoringApi, authApi } from '@/lib/api'

const { Paragraph, Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface ChatMessage {
  id: string
  role: 'ai' | 'user'
  text: string
}

interface ProblemItem {
  id: string
  text: string
  knowledgePoint?: string
  source?: string
  errorRate?: number
  createdAt?: string | Date
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
  
  // 新增模式特定状态
  const [userProfile, setUserProfile] = useState<any>(null)
  const [weakPoints, setWeakPoints] = useState<{nodeId: string, title: string, errorRate: number}[]>([])
  const [mistakes, setMistakes] = useState<ProblemItem[]>([])
  const [knowledgeTree, setKnowledgeTree] = useState<any[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>(undefined)
  const [selectedMistake, setSelectedMistake] = useState<ProblemItem | undefined>(undefined)
  const [dataLoading, setDataLoading] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => {
    const initData = async () => {
      setDataLoading(true)
      try {
        // 1. 获取用户信息
        const profileRes: any = await authApi.getProfile()
        const profile = profileRes.data
        setUserProfile(profile)

        const v = profile.textbookVersion === '浙教版' ? 'zhejiang' : 'renjiao'
        const gMap: Record<string, string> = {
          '初一上': '7a', '初一下': '7b',
          '初二上': '8a', '初二下': '8b',
          '初三上': '9a', '初三下': '9b'
        }
        const g = gMap[profile.grade] || '7a'

        // 2. 并发获取知识图谱和推荐数据
        const [treeRes, recRes] = await Promise.all([
          fetch(`/api/knowledge/tree?version=${v}&grade=${g}`),
          fetch('/api/tutoring/recommend')
        ])

        let validIds = new Set<string>()
        let validTitles = new Set<string>()

        if (treeRes.ok) {
          const treeData = await treeRes.json()
          setKnowledgeTree(treeData)
          
          // 展平节点，用于后续过滤
          const getFlattenNodes = (nodes: any[]): {id: string, title: string}[] => {
            let result: {id: string, title: string}[] = []
            nodes.forEach(n => {
              if (!n.children || n.children.length === 0) {
                result.push({ id: n.id, title: n.title })
              } else {
                result = result.concat(getFlattenNodes(n.children))
              }
            })
            return result
          }
          const flatNodes = getFlattenNodes(treeData)
          validIds = new Set(flatNodes.map(n => n.id))
          validTitles = new Set(flatNodes.map(n => n.title))
        }

        if (recRes.ok) {
          const recData = await recRes.json()
          
          // 过滤薄弱点：只保留属于当前教材版本的节点
          const rawWeakPoints = recData.weakPoints || []
          const filteredWeakPoints = rawWeakPoints.filter((wp: any) => validIds.has(wp.nodeId))
          setWeakPoints(filteredWeakPoints)

          // 过滤错题：APP上传的通过学段过滤，线上练习的通过知识点名称匹配当前教材
          const rawMistakes = recData.mistakes || []
          const filteredMistakes = rawMistakes.filter((m: any) => {
            if (m.source === 'upload') {
              return m.grade === profile.grade
            }
            return m.knowledgePoint && validTitles.has(m.knowledgePoint)
          })
          setMistakes(filteredMistakes)
        }
      } catch (e) {
        console.error('Init data failed', e)
      } finally {
        setDataLoading(false)
      }
    }
    
    initData()
  }, [])

  const handleStartTutoring = async () => {
    if (mode === '查漏补缺' && !selectedTopic) {
      return message.warning('请选择一个薄弱知识点')
    }
    if (mode === '错题复习' && !selectedMistake) {
      return message.warning('请选择一道错题')
    }
    if (mode === '专项突破' && !selectedTopic) {
      return message.warning('请选择一个知识点专题')
    }

    setLoading(true)
    
    try {
      const totalMinutes = questionCount * (difficulty === '基础' ? 3 : difficulty === '中等' ? 5 : 8)
      
      // 动态生成第一道题目
      const genRes: any = await tutoringApi.generateProblem({
        type: 'practice',
        mode,
        difficulty,
        topic: selectedTopic,
        mistakeText: selectedMistake?.text
      })
      const generatedProblemText = genRes.data.problemText || '题目生成失败，请重试'
      
      const initialProblemText = `根据您选择的【${mode}】模式，系统已为您生成 ${questionCount} 道【${difficulty}】难度的专属题目。${timeLimit ? `\n\n🕒 已开启限时挑战，倒计时 ${totalMinutes} 分钟，请注意时间！` : ''}\n\n请看第一题：\n${generatedProblemText}`
      
      const groupId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      
      const res: any = await tutoringApi.createSession(
        initialProblemText, 
        mode, 
        timeLimit ? totalMinutes : undefined, 
        difficulty, 
        groupId, 
        questionCount,
        selectedTopic,
        selectedMistake?.text
      )
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

    // 创建一个占位的 AI 回复消息，后续流式更新其文本
    const aiMsgId = (Date.now() + 1).toString()
    setChatHistory(prev => [...prev, { id: aiMsgId, role: 'ai', text: '' }])

    try {
      const response = await tutoringApi.sendMessage(sessionId, userText)
      
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
            } else if (data.type === 'meta') {
              if (data.currentStep !== undefined) {
                setCurrentStep(data.currentStep)
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (error: any) {
      message.error('发送失败，请重试')
      setChatHistory(prev => prev.filter(msg => msg.id !== tempUserMsg.id && msg.id !== aiMsgId))
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
                onClick={() => {
                  setMode(m.value)
                  setSelectedTopic(undefined)
                  setSelectedMistake(undefined)
                }}
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
              
              {/* 模式专属配置 */}
              <div className="h-[280px] flex-shrink-0">
                {mode === '通用辅导' && (
                  <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 h-full flex flex-col justify-center items-center text-blue-600">
                    <RobotOutlined className="text-5xl mb-4 opacity-50" />
                    <p className="font-bold text-lg mb-2">通用辅导模式</p>
                    <p className="text-sm opacity-80 text-center px-4">系统将根据您当前学段（{userProfile?.grade || '未设置'}）和教材（{userProfile?.textbookVersion || '未设置'}）随机选择核心知识点进行出题。</p>
                  </div>
                )}

                {mode === '查漏补缺' && (
                  <div className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100 h-full flex flex-col">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center flex-shrink-0">
                      <AimOutlined className="text-emerald-500 mr-2" />
                      选择薄弱知识点 <span className="text-xs text-emerald-600 font-normal ml-2 bg-emerald-100 px-2 py-0.5 rounded-full">{userProfile?.textbookVersion} {userProfile?.grade}</span>
                    </h3>
                    <div className="flex-grow overflow-y-auto">
                      {dataLoading ? <div className="flex justify-center items-center h-full"><Spin /></div> : weakPoints.length > 0 ? (
                        <Select 
                          className="w-full" 
                          size="large" 
                          placeholder="请选择你的薄弱知识点"
                          value={selectedTopic}
                          onChange={setSelectedTopic}
                        >
                          {weakPoints.map(wp => (
                            <Option key={wp.nodeId} value={wp.title}>
                              {wp.title} <span className="text-red-500 text-xs ml-2">错题率 {(wp.errorRate).toFixed(1)}%</span>
                            </Option>
                          ))}
                        </Select>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Empty description="太棒了，你暂时没有薄弱知识点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {mode === '错题复习' && (
                  <div className="bg-rose-50/50 p-6 rounded-xl border border-rose-100 h-full flex flex-col">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center flex-shrink-0">
                      <HistoryOutlined className="text-rose-500 mr-2" />
                      选择错题 <span className="text-xs text-rose-600 font-normal ml-2 bg-rose-100 px-2 py-0.5 rounded-full">{userProfile?.textbookVersion} {userProfile?.grade}</span>
                    </h3>
                    <div className="flex-grow overflow-y-auto pr-2">
                      {dataLoading ? <div className="flex justify-center items-center h-full"><Spin /></div> : mistakes.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {mistakes.map((item) => (
                            <div
                              key={item.id}
                              className={`cursor-pointer rounded-lg p-3 border transition-colors ${selectedMistake?.id === item.id ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-white hover:border-rose-300'}`}
                              onClick={() => setSelectedMistake(item)}
                            >
                              <div className="flex flex-col w-full">
                                <div className="text-sm text-slate-800 line-clamp-2 mb-2">{item.text}</div>
                                <div className="flex justify-between items-center text-xs text-slate-400">
                                  <span>{new Date(item.createdAt || Date.now()).toLocaleDateString()}</span>
                                  <Tag color={item.source === 'online' ? 'blue' : 'purple'}>{item.source === 'online' ? '线上练习' : '自主上传'}</Tag>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Empty description="错题本为空" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {mode === '专项突破' && (
                  <div className="bg-amber-50/50 p-6 rounded-xl border border-amber-100 h-full flex flex-col">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center flex-shrink-0">
                      <BulbOutlined className="text-amber-500 mr-2" />
                      选择知识点专题 <span className="text-xs text-amber-600 font-normal ml-2 bg-amber-100 px-2 py-0.5 rounded-full">{userProfile?.textbookVersion} {userProfile?.grade}</span>
                    </h3>
                    <div className="flex-grow overflow-y-auto">
                      {dataLoading ? <div className="flex justify-center items-center h-full"><Spin /></div> : (
                        <Select 
                          className="w-full" 
                          size="large" 
                          placeholder="请选择知识点"
                          value={selectedTopic}
                          onChange={setSelectedTopic}
                          showSearch
                          filterOption={(input, option) =>
                            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                          }
                          options={(() => {
                            const flattenNodes = (nodes: any[], prefix = ''): {label: string, value: string}[] => {
                              let result: {label: string, value: string}[] = []
                              nodes.forEach(n => {
                                const name = prefix ? `${prefix} - ${n.title}` : n.title
                                if (!n.children || n.children.length === 0) {
                                  result.push({ label: name, value: n.title })
                                } else {
                                  result = result.concat(flattenNodes(n.children, name))
                                }
                              })
                              return result
                            }
                            return flattenNodes(knowledgeTree)
                          })()}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
              
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
