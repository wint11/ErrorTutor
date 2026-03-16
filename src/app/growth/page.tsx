'use client'

import React, { useEffect, useState } from 'react'
import { Card, List, Tag, Statistic, Row, Col, message } from 'antd'
import { RiseOutlined, BookOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { growthApi } from '@/lib/api'
import dayjs from 'dayjs'

interface MistakeRecord {
  id: string
  problemText: string
  errorType: string
  knowledgePoint: string
  status: string
  createdAt: string
}

interface GrowthStats {
  totalMistakes: number
  resolvedMistakes: number
  recentMistakes: MistakeRecord[]
}

export default function Growth() {
  const [stats, setStats] = useState<GrowthStats>({
    totalMistakes: 0,
    resolvedMistakes: 0,
    recentMistakes: []
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchGrowthData()
  }, [])

  const fetchGrowthData = async () => {
    setLoading(true)
    try {
      const res: any = await growthApi.getStats()
      setStats(res.data)
    } catch (error) {
      message.error('获取成长数据失败')
    } finally {
      setLoading(false)
    }
  }

  const getErrorTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      '审题错误': 'red',
      '设元错误': 'orange',
      '列式错误': 'blue',
      '计算错误': 'purple'
    }
    return colors[type] || 'default'
  }

  return (
    <div className="flex-grow w-full py-4 md:py-8">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">成长轨迹</h2>
        <p className="text-gray-500 mt-1 md:mt-2 text-sm md:text-base">记录你的每一次进步</p>
      </div>

      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100" loading={loading}>
            <Statistic 
              title="累计错题" 
              value={stats.totalMistakes} 
              suffix="道" 
              valueStyle={{ color: '#cf1322' }}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100" loading={loading}>
            <Statistic 
              title="已消灭错误" 
              value={stats.resolvedMistakes} 
              suffix="个" 
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-xl shadow-sm border-gray-100" loading={loading}>
            <Statistic 
              title="消灭率" 
              value={stats.totalMistakes > 0 
                ? Math.round((stats.resolvedMistakes / stats.totalMistakes) * 100) 
                : 0} 
              suffix="%" 
              valueStyle={{ color: '#1890ff' }}
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title="错题记录" 
        className="rounded-xl shadow-sm border-gray-100"
        loading={loading}
      >
        <List
          dataSource={stats.recentMistakes}
          locale={{ emptyText: '太棒了，还没有错题记录！' }}
          renderItem={item => (
            <List.Item
              actions={[
                <Tag key="status" color={item.status === '已复习' ? 'green' : 'orange'}>
                  {item.status}
                </Tag>
              ]}
            >
              <List.Item.Meta
                title={
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 line-clamp-1">{item.problemText}</span>
                  </div>
                }
                description={
                  <div className="flex items-center gap-2 mt-1">
                    <Tag color={getErrorTypeColor(item.errorType)}>{item.errorType}</Tag>
                    <Tag color="blue">{item.knowledgePoint}</Tag>
                    <span className="text-gray-400 text-sm">
                      {dayjs(item.createdAt).format('YYYY-MM-DD')}
                    </span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
