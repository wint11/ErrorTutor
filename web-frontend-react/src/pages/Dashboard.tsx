import React, { useEffect, useState } from 'react'
import { Card, Button, Statistic, Row, Col, List, Tag, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PlusOutlined, EditOutlined, BarChartOutlined } from '@ant-design/icons'
import { useUserStore } from '../store/userStore'
import request from '../utils/request'
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

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
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
      const res: any = await request.get('/dashboard/stats')
      setStats(res)
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
          className="h-10 md:h-12 px-4 md:px-6 rounded-lg shadow-md w-full md:w-auto"
          onClick={() => navigate('/tutoring')}
        >
          录入新题目 / 开始辅导
        </Button>
      </div>

      {/* 核心数据概览 */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100" loading={loading}>
            <Statistic title="已解决题目" value={stats.resolvedCount} suffix="道" valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100" loading={loading}>
            <Statistic title="累计消灭错误" value={stats.eliminatedErrorsCount} suffix="个" valueStyle={{ color: '#cf1322' }} />
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
            extra={<Button type="link" onClick={() => navigate('/growth')}>查看全部</Button>}
            bodyStyle={{ padding: '0 12px' }}
          >
            <List
              loading={loading}
              dataSource={stats.recentMistakes}
              locale={{ emptyText: '太棒了，最近没有产生错题！' }}
              renderItem={item => (
                <List.Item
                  className="px-2"
                  actions={[
                    <Button type="link" size="small" onClick={() => navigate('/tutoring')}>复习</Button>
                  ]}
                >
                  <List.Item.Meta
                    title={<span className="font-medium text-gray-800 line-clamp-2 md:line-clamp-1 text-sm md:text-base">{item.problemText}</span>}
                    description={<span className="text-xs md:text-sm">{`诊断日期: ${dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}`}</span>}
                  />
                  <Tag className="hidden md:inline-block" color={item.errorType.includes('计算') ? 'orange' : 'red'}>{item.errorType}</Tag>
                </List.Item>
              )}
            />
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
                <li>做题时多使用“如果...那么...”的生活类比。</li>
                <li>试着把题目中的核心数学关系圈出来。</li>
              </ul>
              <Button type="primary" ghost className="mt-6 w-full h-10 border-primary-200 text-primary-600 hover:text-white hover:bg-primary-500" onClick={() => navigate('/tutoring')}>
                去练一道专属变式题
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard