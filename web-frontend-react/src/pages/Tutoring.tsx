import React, { useState, useEffect, useRef } from 'react'
import { Card, Input, Button, Steps, Typography, Tag, message, Tabs, List, Radio, Space } from 'antd'
import { RobotOutlined, SendOutlined, BookOutlined, AimOutlined, BulbOutlined, HistoryOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import request from '../utils/request'

const { Title, Paragraph, Text } = Typography
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

const Tutoring: React.FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [sessionId, setSessionId] = useState<string | null>(id || null)
  const [currentStep, setCurrentStep] = useState(0)
  const [problemText, setProblemText] = useState('')
  const [mode, setMode] = useState('通用辅导')
  const [isProblemSet, setIsProblemSet] = useState(!!id)
  const [loading, setLoading] = useState(false)

  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  
  const [historyProblems, setHistoryProblems] = useState<ProblemItem[]>([])
  const [recommendProblems, setRecommendProblems] = useState<ProblemItem[]>([])

  const chatEndRef = useRef<HTMLDivElement>(null)

  // 滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // 如果有 id，加载会话详情
  useEffect(() => {
    if (id) {
      loadSession(id)
    } else {
      fetchProblemSources()
    }
  }, [id])

  const fetchProblemSources = async () => {
    try {
      const [historyRes, recommendRes] = await Promise.all([
        request.get<any, ProblemItem[]>('/tutoring/history'),
        request.get<any, ProblemItem[]>('/tutoring/recommend')
      ])
      setHistoryProblems(historyRes)
      setRecommendProblems(recommendRes)
    } catch (error) {
      console.error('加载题目来源失败', error)
    }
  }

  const loadSession = async (sid: string) => {
    try {
      const res: any = await request.get(`/tutoring/${sid}`)
      setProblemText(res.problemText)
      setCurrentStep(res.currentStep)
      setChatHistory(res.messages)
      setIsProblemSet(true)
    } catch (error) {
      message.error('加载会话失败')
      navigate('/tutoring')
    }
  }

  // 提交题目，开始新会话
  const handleSetProblem = async () => {
    if (!problemText.trim()) return
    setLoading(true)
    try {
      const res: any = await request.post('/tutoring/start', { problemText, mode })
      setSessionId(res.sessionId)
      setChatHistory(res.messages)
      setIsProblemSet(true)
      navigate(`/tutoring/${res.sessionId}`, { replace: true })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // 发送聊天消息
  const handleSendChat = async () => {
    if (!chatInput.trim() || !sessionId) return

    const userText = chatInput
    setChatInput('')
    
    // 乐观更新 UI
    const tempUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: userText }
    setChatHistory(prev => [...prev, tempUserMsg])
    setLoading(true)

    try {
      const res: any = await request.post(`/tutoring/${sessionId}/chat`, { text: userText })
      setChatHistory(prev => [...prev, res.message])
      setCurrentStep(res.currentStep)
      
      if (res.mistakeRecorded) {
        message.warning('系统已将该薄弱点加入错题本！')
      }
    } catch (error) {
      message.error('发送失败，请重试')
      // 失败则移除刚才的乐观更新 (简单处理)
      setChatHistory(prev => prev.filter(msg => msg.id !== tempUserMsg.id))
    } finally {
      setLoading(false)
    }
  }

  const renderSetupView = () => (
    <div className="w-full h-auto lg:h-full flex flex-col lg:flex-row gap-6">
      {/* 左侧：选择辅导模式 */}
      <Card title="第一步：选择辅导模式" className="rounded-xl shadow-sm border-slate-100 flex-shrink-0 lg:w-1/3 flex flex-col h-auto lg:h-full" bodyStyle={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Radio.Group onChange={(e) => setMode(e.target.value)} value={mode} className="w-full flex-grow flex flex-col min-h-0">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 flex-grow lg:overflow-y-auto lg:pr-2">
            <Radio.Button value="通用辅导" className="h-full min-h-[80px] p-4 rounded-xl text-center border-slate-200 flex flex-col items-center justify-center">
              <div className="text-xl mb-2 text-primary-500"><RobotOutlined /></div>
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

      {/* 右侧：选择或录入题目 */}
      <Card title="第二步：选择或录入题目" className="rounded-xl shadow-sm border-slate-100 flex-grow flex flex-col min-w-0 min-h-[500px] lg:h-full lg:min-h-0" bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '16px', minHeight: 0 }}>
        <Tabs
          defaultActiveKey="history"
          className="flex-grow flex flex-col min-h-0"
          items={[
            {
              key: 'history',
              label: '📱 历史上传 (APP同步)',
              children: (
                <div className="relative h-[400px] lg:h-full lg:absolute lg:inset-0 lg:overflow-y-auto lg:pr-2">
                  <List
                    dataSource={historyProblems}
                    renderItem={item => (
                      <List.Item 
                        className="cursor-pointer hover:bg-slate-50 transition-colors px-4 rounded-lg border-b border-slate-50"
                        onClick={() => setProblemText(item.problemText || '')}
                      >
                        <List.Item.Meta
                          title={<Text className="text-slate-800">{item.problemText}</Text>}
                          description={<Tag color="blue">{item.status}</Tag>}
                        />
                      </List.Item>
                    )}
                    locale={{ emptyText: '暂无APP上传记录' }}
                  />
                </div>
              )
            },
            {
              key: 'recommend',
              label: '💡 智能推荐',
              children: (
                <div className="relative h-[400px] lg:h-full lg:absolute lg:inset-0 lg:overflow-y-auto lg:pr-2">
                  <List
                    dataSource={recommendProblems}
                    renderItem={item => (
                      <List.Item 
                        className="cursor-pointer hover:bg-slate-50 transition-colors px-4 rounded-lg border-b border-slate-50"
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
                <div className="relative h-[400px] lg:h-full lg:absolute lg:inset-0">
                  <TextArea 
                    placeholder="请在此粘贴或输入中学数学题目..." 
                    value={problemText}
                    onChange={(e) => setProblemText(e.target.value)}
                    className="text-lg p-4 resize-none h-full w-full"
                  />
                </div>
              )
            }
          ]}
        />
        
        {/* 已选题目预览 & 按钮 (固定高度避免布局跳动) */}
        <div className="mt-4 pt-4 flex-none border-t border-slate-100 h-[180px] flex flex-col">
          <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 flex-grow flex flex-col min-h-0">
            <div className="text-sm text-slate-500 mb-1 flex-none">已选题目：</div>
            {problemText ? (
              <div className="text-base text-slate-800 font-medium overflow-y-auto pr-2 min-h-0">{problemText}</div>
            ) : (
              <div className="text-base text-slate-400 font-medium flex items-center justify-center flex-grow">暂未选择或输入题目，请在上方操作</div>
            )}
          </div>
          <Button 
            type="primary" 
            size="large" 
            onClick={handleSetProblem} 
            disabled={!problemText.trim()} 
            loading={loading}
            className="w-full h-12 text-lg rounded-xl flex-none"
          >
            开启智能辅导
          </Button>
        </div>
      </Card>
    </div>
  )

  const renderChatView = () => (
    <div className="w-full h-auto lg:h-full flex flex-col lg:flex-row gap-6">
      {/* 左侧：题目与进度 */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6 h-auto lg:h-full">
        <Card title="当前题目" className="rounded-xl shadow-sm border-slate-100 flex-none h-[300px] lg:h-[60%] lg:min-h-[200px] flex flex-col" bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '20px' }}>
          <div className="flex-grow lg:overflow-y-auto lg:pr-2 min-h-0 overflow-visible">
            <Paragraph className="text-base md:text-lg leading-relaxed text-slate-700 m-0">{problemText}</Paragraph>
          </div>
          <div className="mt-4 flex-none pt-4 border-t border-slate-100">
            <Tag color="blue">中学数学</Tag>
            <Tag color="purple">{mode}</Tag>
          </div>
        </Card>

        <Card title="解题进度" className="rounded-xl shadow-sm border-slate-100 hidden lg:flex flex-col flex-grow min-h-0" bodyStyle={{ flex: 1, padding: '20px', overflowY: 'auto', minHeight: 0 }}>
          <Steps
            direction="vertical"
            current={currentStep}
            items={[
              { title: '理解题意', description: '提取已知条件和所求' },
              { title: '知识点映射', description: '关联核心数学概念' },
              { title: '逻辑建模', description: '寻找等量关系或几何特征' },
              { title: '求解验算', description: '计算过程' }
            ]}
          />
        </Card>
        
        {/* 移动端横向步骤条 */}
        <Card className="rounded-xl shadow-sm border-slate-100 lg:hidden p-2 flex-none">
           <Steps
            size="small"
            current={currentStep}
            items={[
              { title: '理解' },
              { title: '映射' },
              { title: '建模' },
              { title: '求解' }
            ]}
          />
        </Card>
      </div>

      {/* 右侧：交互式对话区 */}
      <Card 
        className="w-full lg:w-2/3 rounded-xl shadow-sm border-slate-100 flex flex-col h-[600px] lg:h-full min-w-0 overflow-hidden"
        bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 0, minHeight: 0 }}
      >
        <div className="bg-primary-50 p-4 border-b border-primary-100 flex items-center justify-between flex-none">
          <div className="flex items-center text-primary-800 font-bold text-lg">
            <RobotOutlined className="mr-2 text-2xl" />
            AI 专属导师 - {mode}
          </div>
        </div>
        
        {/* 聊天记录 */}
        <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4 bg-slate-50 min-h-0">
          {chatHistory.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary-500 text-white rounded-br-sm' 
                    : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* 输入区 */}
        <div className="p-4 border-t border-slate-100 bg-white flex-none">
          <div className="flex gap-3">
            <Input 
              size="large" 
              placeholder={currentStep >= 4 ? "辅导已完成" : "输入你的想法或答案..."} 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onPressEnter={handleSendChat}
              disabled={currentStep >= 4 || loading}
              className="rounded-xl border-slate-200 hover:border-primary-400 focus:border-primary-500"
            />
            <Button 
              type="primary" 
              size="large" 
              icon={<SendOutlined />} 
              onClick={handleSendChat}
              disabled={currentStep >= 4 || loading}
              className="rounded-xl px-6"
            >
              发送
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )

  return (
    <div className="w-full flex-1 lg:h-[calc(100vh-64px)] py-4 md:py-6 flex flex-col box-border lg:overflow-hidden">
      {!isProblemSet ? renderSetupView() : renderChatView()}
    </div>
  )
}

export default Tutoring