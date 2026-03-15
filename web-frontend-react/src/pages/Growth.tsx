import React, { useEffect, useState, useMemo } from 'react'
import { Card, Table, Tag, Typography, Row, Col, message, Tabs, Statistic, Progress } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, RiseOutlined, CrownOutlined } from '@ant-design/icons'
import request from '../utils/request'
import dayjs from 'dayjs'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts'

const { Title, Text } = Typography

interface Mistake {
  id: string
  createdAt: string
  problemText: string
  errorType: string
  knowledgePoint: string
  status: string
}

interface StatsData {
  radar: {
    personal: { subject: string, score: number }[]
    peer: { subject: string, score: number }[]
  }
  percentile: number
  trend: {
    weekly: { date: string, resolved: number, mistakes: number }[]
    monthly: { month: string, resolved: number, mistakes: number }[]
  }
}

const Growth: React.FC = () => {
  const [data, setData] = useState<Mistake[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState('weekly')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [mistakesRes, statsRes] = await Promise.all([
        request.get('/growth/mistakes'),
        request.get('/growth/stats')
      ])
      setData(mistakesRes as any)
      setStats(statsRes as any)
    } catch (error) {
      message.error('获取成长数据失败')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: '15%',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '错题简述',
      dataIndex: 'problemText',
      key: 'problemText',
      render: (text: string) => <Text ellipsis style={{ maxWidth: 300 }}>{text}</Text>,
    },
    {
      title: '错误类型',
      dataIndex: 'errorType',
      key: 'errorType',
      render: (type: string) => {
        let color = type.includes('计算') ? 'orange' : type.includes('概念') ? 'magenta' : 'volcano'
        return <Tag color={color}>{type}</Tag>
      },
    },
    {
      title: '薄弱知识点',
      dataIndex: 'knowledgePoint',
      key: 'knowledgePoint',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        status === '已复习' 
          ? <Text type="success"><CheckCircleOutlined /> {status}</Text>
          : <Text type="warning"><CloseCircleOutlined /> {status}</Text>
      ),
    },
  ]

  // 合并雷达图数据格式，供 Recharts 使用
  const radarDataMerged = useMemo(() => {
    if (!stats) return []
    return stats.radar.personal.map(p => {
      const peerItem = stats.radar.peer.find(pe => pe.subject === p.subject)
      return {
        subject: p.subject,
        '我的能力': p.score,
        '同龄人均值': peerItem?.score || 0
      }
    })
  }, [stats])

  return (
    <div className="w-full flex-1 h-auto lg:h-[calc(100vh-64px)] py-4 md:py-6 flex flex-col gap-4 md:gap-6 min-h-0">
      
      {/* 顶部概览卡片 */}
      <Row gutter={[16, 16]} className="flex-none h-auto md:h-[40%] min-h-[240px]">
        <Col xs={24} md={8} className="h-full">
          <Card 
            className="rounded-xl shadow-sm border-slate-100 h-full text-white"
            style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' }}
            bodyStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px' }}
          >
            <div className="flex items-center justify-between w-full relative z-10">
              {loading ? (
                 <div className="flex flex-col items-center justify-center w-full">
                    <div className="text-white/80 text-lg">正在加载分析数据...</div>
                 </div>
              ) : stats ? (
                <div>
                  <div className="text-primary-100 mb-1 font-medium text-base">综合学习评级</div>
                  <div className="text-sm text-white/90 mb-2">击败了全国</div>
                  <div className="text-6xl font-bold mb-2">{stats.percentile}%</div>
                  <div className="text-primary-100 mt-1 text-sm">的同龄学生</div>
                </div>
              ) : (
                <div>
                  <div className="text-primary-100 mb-1 font-medium text-base">综合学习评级</div>
                  <div className="text-2xl font-bold mt-4 mb-2">暂无评级数据</div>
                  <div className="text-primary-100 text-sm">多做题，系统将为你生成专属画像</div>
                </div>
              )}
              <CrownOutlined className="text-7xl opacity-20 absolute right-4 top-1/2 -translate-y-1/2" />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={16} className="h-full">
          <Card className="rounded-xl shadow-sm border-slate-100 h-full flex flex-col" bodyStyle={{ display: 'flex', flexDirection: 'column', padding: '20px', height: '100%', minHeight: 0 }}>
            <div className="flex justify-between items-center mb-4 flex-none">
              <Title level={5} className="!mb-0"><RiseOutlined className="mr-2 text-primary-500" />学习活跃度趋势</Title>
              <Tabs 
                size="small" 
                activeKey={timeRange} 
                onChange={setTimeRange}
                items={[
                  { key: 'weekly', label: '近7天' },
                  { key: 'monthly', label: '近半年' }
                ]}
                className="mb-0"
              />
            </div>
            <div className="flex-grow w-full min-h-0 h-[300px] lg:h-auto">
              {stats ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeRange === 'weekly' ? stats.trend.weekly : stats.trend.monthly} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey={timeRange === 'weekly' ? 'date' : 'month'} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <RechartsTooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" name="刷题量" dataKey="resolved" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" />
                    <Line type="monotone" name="错题数" dataKey="mistakes" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  {loading ? '正在加载数据...' : '暂无学习趋势数据，快去刷题吧！'}
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 雷达图与能力分析 */}
      <Row gutter={[16, 16]} className="flex-grow min-h-0">
        <Col xs={24} lg={8} className="h-full">
          <Card className="rounded-xl shadow-sm border-slate-100 h-full flex flex-col" bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', minHeight: 0 }}>
            <Title level={5} className="mb-2 flex-none">多维能力画像</Title>
            <div className="flex-grow w-full min-h-0 h-[300px] lg:h-auto flex flex-col">
              {radarDataMerged.length > 0 ? (
                <div className="flex-grow w-full h-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarDataMerged} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="我的能力" dataKey="我的能力" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.4} />
                      <Radar name="同龄人均值" dataKey="同龄人均值" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} strokeDasharray="3 3" />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <RechartsTooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  {loading ? '正在加载画像...' : '做几道题，解锁你的能力画像'}
                </div>
              )}
            </div>
          </Card>
        </Col>
        
        <Col xs={24} lg={16} className="h-full">
          <Card className="rounded-xl shadow-sm border-slate-100 h-full flex flex-col overflow-hidden" bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', minHeight: 0 }}>
            <Title level={5} className="mb-4 flex-none">历史错题记录 (真实闭环数据)</Title>
            <div className="flex-grow overflow-auto min-h-[300px] lg:min-h-0">
              <Table 
                dataSource={data} 
                columns={columns} 
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 4, responsive: true }}
                scroll={{ x: 'max-content' }}
                size="small"
              />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Growth