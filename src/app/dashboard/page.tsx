'use client'

import React, { useEffect, useState } from 'react'
import { Card, Button, Statistic, Row, Col, Tag, message, Empty, Spin } from 'antd'
import { useRouter } from 'next/navigation'
import { PlusOutlined, EditOutlined, BarChartOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import { dashboardApi } from '@/lib/api'
import dayjs from 'dayjs'

interface DashboardStats {
  grade: string
  level: string
  resolvedCount: number
  eliminatedErrorsCount: number
  mostFrequentError: string
  todayStudyMinutes: number
  streakDays: number
  todaySessions: {
    id: string
    problemText: string
    status: string
    createdAt: string
  }[]
}

export default function Dashboard() {
  const router = useRouter()
  const { username } = useUserStore()
  const [stats, setStats] = useState<DashboardStats>({
    grade: '-',
    level: '-',
    resolvedCount: 0,
    eliminatedErrorsCount: 0,
    mostFrequentError: '-',
    todayStudyMinutes: 0,
    streakDays: 0,
    todaySessions: []
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res: any = await dashboardApi.getStats()
      setStats(res.data)
    } catch (error) {
      message.error('获取统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-grow w-full py-4 md:py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 m-0">你好, {username} 👋</h2>
            {!loading && stats.grade !== '-' && (
              <div className="flex gap-2">
                <Tag color="blue" className="rounded-full px-3">{stats.grade}</Tag>
                <Tag color="cyan" className="rounded-full px-3">{stats.level}</Tag>
              </div>
            )}
          </div>
          <p className="text-gray-500 mt-2 text-sm md:text-base">准备好攻克今天的数学题了吗？</p>
        </div>
        <Button 
          type="primary" 
          size="large" 
          icon={<PlusOutlined />} 
          className="h-10 md:h-12 px-4 md:px-6 rounded-lg shadow-md w-full md:w-auto bg-blue-600 hover:bg-blue-500"
          onClick={() => router.push('/tutoring')}
        >
          录入新题目 / 开始辅导
        </Button>
      </div>

      {/* 核心数据概览 */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100 bg-gradient-to-br from-blue-50 to-white" loading={loading}>
            <Statistic title="今日辅导时长" value={stats.todayStudyMinutes} suffix="分钟" styles={{ content: { color: '#1677ff' } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100 bg-gradient-to-br from-emerald-50 to-white" loading={loading}>
            <Statistic title="今日攻克题目" value={stats.resolvedCount} suffix="道" styles={{ content: { color: '#3f8600' } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100 bg-gradient-to-br from-orange-50 to-white" loading={loading}>
            <Statistic title="连续学习打卡" value={stats.streakDays} suffix="天" styles={{ content: { color: '#fa8c16' } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card 
            title={<span className="text-base md:text-lg font-bold text-slate-800"><BarChartOutlined className="mr-2 text-blue-500" />今日学习动态</span>} 
            className="rounded-xl shadow-sm border-gray-100 h-full overflow-hidden"
            extra={<Button type="link" onClick={() => router.push('/tutoring')}>继续学习</Button>}
            styles={{ body: { padding: '0 12px' } }}
          >
            {loading ? (
              <div className="py-8 text-center"><Spin /></div>
            ) : stats.todaySessions.length === 0 ? (
              <Empty description="今天还没有开始学习哦，快去录入题目吧！" className="py-8" />
            ) : (
              <div className="divide-y divide-gray-100">
                {stats.todaySessions.map(item => (
                  <div key={item.id} className="py-4 px-2 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-lg">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="font-medium text-gray-800 line-clamp-1">{item.problemText}</div>
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <span>今天 {dayjs(item.createdAt).format('HH:mm')}</span>
                        <span className="text-slate-300">|</span>
                        <span className={item.status === 'COMPLETED' ? 'text-emerald-500' : 'text-blue-500'}>
                          {item.status === 'COMPLETED' ? '辅导完成' : '进行中'}
                        </span>
                      </div>
                    </div>
                    <Button type="primary" ghost size="small" className="rounded-md border-blue-200" onClick={() => router.push(`/tutoring/${item.id}`)}>
                      回顾过程
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        
        <Col xs={24} lg={8}>
          <Card 
            title={<span className="text-lg font-bold text-slate-800"><EditOutlined className="mr-2 text-indigo-500" />智能练习推荐</span>} 
            className="rounded-xl shadow-sm border-gray-100 bg-indigo-50/30 h-full"
            loading={loading}
          >
            <div className="flex flex-col h-full justify-between">
              <div className="prose prose-sm text-slate-600 mb-6">
                <p>根据你今天的学习情况，系统为你生成了<strong>专属强化练习</strong>：</p>
                <div className="bg-white p-4 rounded-lg border border-indigo-100 mt-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <Tag color="indigo" className="border-none">专项突破</Tag>
                    <span className="text-xs text-slate-400">预计 10 分钟</span>
                  </div>
                  <p className="font-medium text-slate-700 m-0">一元一次方程的应用（行程问题）变式训练</p>
                </div>
              </div>
              <Button type="primary" size="large" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-200" onClick={() => router.push('/tutoring')}>
                立即开始挑战
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
