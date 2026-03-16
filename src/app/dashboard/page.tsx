'use client'

import React, { useEffect, useState } from 'react'
import { Card, Button, Statistic, Row, Col, Tag, message, Empty, Spin } from 'antd'
import { useRouter } from 'next/navigation'
import { PlusOutlined, EditOutlined, BarChartOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import { dashboardApi } from '@/lib/api'
import dayjs from 'dayjs'

interface DashboardStats {
  resolvedCount: number
  eliminatedErrorsCount: number
  mostFrequentError: string
  recentMistakes: {
    id: string
    problemText: string
    errorType: string
    createdAt: string
  }[]
}

export default function Dashboard() {
  const router = useRouter()
  const { username } = useUserStore()
  const [stats, setStats] = useState<DashboardStats>({
    resolvedCount: 0,
    eliminatedErrorsCount: 0,
    mostFrequentError: '-',
    recentMistakes: []
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
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">你好, {username} 👋</h2>
          <p className="text-gray-500 mt-1 md:mt-2 text-sm md:text-base">准备好攻克今天的数学题了吗？</p>
        </div>
        <Button 
          type="primary" 
          size="large" 
          icon={<PlusOutlined />} 
          className="h-10 md:h-12 px-4 md:px-6 rounded-lg shadow-md w-full md:w-auto bg-blue-600"
          onClick={() => router.push('/tutoring')}
        >
          录入新题目 / 开始辅导
        </Button>
      </div>

      {/* 核心数据概览 */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100" loading={loading}>
            <Statistic title="已解决题目" value={stats.resolvedCount} suffix="道" styles={{ content: { color: '#3f8600' } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100" loading={loading}>
            <Statistic title="累计消灭错误" value={stats.eliminatedErrorsCount} suffix="个" styles={{ content: { color: '#cf1322' } }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100" loading={loading}>
            <Statistic title="最常犯错类型" value={stats.mostFrequentError} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card 
            title={<span className="text-base md:text-lg font-bold"><EditOutlined className="mr-2" />最近错题回顾</span>} 
            className="rounded-xl shadow-sm border-gray-100 h-full overflow-hidden"
            extra={<Button type="link" onClick={() => router.push('/growth')}>查看全部</Button>}
            styles={{ body: { padding: '0 12px' } }}
          >
            {loading ? (
              <div className="py-8 text-center"><Spin /></div>
            ) : stats.recentMistakes.length === 0 ? (
              <Empty description="太棒了，最近没有产生错题！" className="py-8" />
            ) : (
              <div className="divide-y divide-gray-100">
                {stats.recentMistakes.map(item => (
                  <div key={item.id} className="py-3 px-2 flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="font-medium text-gray-800 line-clamp-2 md:line-clamp-1 text-sm md:text-base">{item.problemText}</div>
                      <div className="text-xs md:text-sm text-gray-500 mt-1">{`诊断日期: ${dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}`}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag className="hidden md:inline-block" color={item.errorType.includes('计算') ? 'orange' : 'red'}>{item.errorType}</Tag>
                      <Button type="link" size="small" onClick={() => router.push('/tutoring')}>复习</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
        
        <Col xs={24} lg={8}>
          <Card 
            title={<span className="text-lg font-bold"><BarChartOutlined className="mr-2" />学习建议</span>} 
            className="rounded-xl shadow-sm border-gray-100 bg-blue-50/50 h-full"
            loading={loading}
          >
            <div className="prose prose-sm text-slate-600">
              <p>系统发现你在<strong>{stats.mostFrequentError !== '暂无数据' ? stats.mostFrequentError : '各个方面'}</strong>上表现需要关注。</p>
              <p>💡 <strong>建议：</strong></p>
              <ul className="list-disc pl-4 space-y-2 mt-2">
                <li>做题时多使用"如果...那么..."的生活类比。</li>
                <li>试着把题目中的核心数学关系圈出来。</li>
              </ul>
              <Button type="primary" ghost className="mt-6 w-full h-10 border-blue-200 text-blue-600 hover:text-white hover:bg-blue-500" onClick={() => router.push('/tutoring')}>
                去练一道专属变式题
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
