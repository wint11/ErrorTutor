'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Card, Tag, Statistic, Row, Col, message, DatePicker, Select, Input } from 'antd'
import { RiseOutlined, BookOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { growthApi, tutoringApi } from '@/lib/api'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'

dayjs.extend(isBetween)

const { RangePicker } = DatePicker;

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
}


export default function Growth() {
  const router = useRouter()
  const [stats, setStats] = useState<GrowthStats>({
    totalMistakes: 0,
    resolvedMistakes: 0
  })
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // 筛选状态
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchGrowthData()
  }, [])

  const fetchGrowthData = async () => {
    setLoading(true)
    try {
      const [statsRes, mistakesRes]: any = await Promise.all([
        growthApi.getStats(),
        growthApi.getMistakes()
      ])
      setStats({
        totalMistakes: statsRes.data.totalMistakes,
        resolvedMistakes: statsRes.data.resolvedMistakes
      })
      setMistakes(mistakesRes.data || [])
    } catch (error) {
      message.error('获取成长数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleReviewMistake = async (mistake: MistakeRecord) => {
    if (generating) return
    setGenerating(true)
    const hide = message.loading('正在为你生成针对性辅导...', 0)
    
    try {
      // 动态生成题目
      const genRes: any = await tutoringApi.generateProblem({ 
        type: 'practice', 
        mode: '错题复习',
        topic: mistake.knowledgePoint,
        mistakeText: mistake.problemText
      })
      const problemText = genRes.data.problemText || '题目生成失败，请重试'
      
      const initialProblemText = `根据你的错题记录，系统已为你生成了一道专属的错题变式训练。\n\n请看题：\n${problemText}`

      const res: any = await tutoringApi.createSession(
        initialProblemText, 
        '错题复习', 
        undefined, // timeLimit
        '基础', // difficulty
        undefined, // groupId
        1, // questionCount
        mistake.knowledgePoint,
        mistake.problemText
      )
      hide()
      message.success('已进入辅导模式！')
      router.push(`/tutoring/${res.data.id}`)
    } catch (error: any) {
      hide()
      message.error(error.response?.data?.error || '开启辅导失败')
    } finally {
      setGenerating(false)
    }
  }

  const filteredMistakes = useMemo(() => {
    return mistakes.filter(item => {
      // 关键字搜索（知识点或题目内容）
      const matchSearch = !searchText || 
        (item.knowledgePoint && item.knowledgePoint.includes(searchText)) ||
        (item.problemText && item.problemText.includes(searchText));
      
      // 日期范围过滤
      let matchDate = true;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const itemDate = dayjs(item.createdAt);
        matchDate = itemDate.isBetween(dateRange[0].startOf('day'), dateRange[1].endOf('day'), null, '[]');
      }
      
      // 状态过滤
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      
      return matchSearch && matchDate && matchStatus;
    });
  }, [mistakes, searchText, dateRange, statusFilter])

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
              styles={{ content: { color: '#cf1322' } }}
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
              styles={{ content: { color: '#3f8600' } }}
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
              styles={{ content: { color: '#1890ff' } }}
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
        <div className="flex gap-4 items-center flex-wrap mb-6 bg-slate-50 p-4 rounded-lg">
          <Input 
            placeholder="搜索题目或知识点" 
            prefix={<SearchOutlined className="text-gray-400" />} 
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full md:w-64"
            allowClear
          />
          <RangePicker 
            value={dateRange}
            onChange={setDateRange as any}
            className="w-full md:w-72"
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-full md:w-32"
            options={[
              { value: 'all', label: '全部状态' },
              { value: '待复习', label: '待复习' },
              { value: '已复习', label: '已复习' },
            ]}
          />
        </div>
        
        {mistakes.length === 0 ? (
          <div className="py-12 text-center text-gray-400">太棒了，还没有错题记录！</div>
        ) : filteredMistakes.length === 0 ? (
          <div className="py-12 text-center text-gray-400">没有找到符合条件的错题记录</div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* 表头 */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50/80 text-slate-500 font-medium text-sm rounded-lg mb-1">
              <div className="col-span-6">题目内容</div>
              <div className="col-span-3">考点与错误类型</div>
              <div className="col-span-2">收录时间</div>
              <div className="col-span-1 text-center">状态</div>
            </div>

            {/* 列表内容 */}
            {filteredMistakes.map(item => (
              <div 
                key={item.id} 
                className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-3 px-4 bg-white hover:bg-blue-50/50 transition-all rounded-xl cursor-pointer group border border-gray-100 hover:border-blue-200 hover:shadow-sm"
                onClick={() => handleReviewMistake(item)}
              >
                {/* 题目内容区域：占据 6/12 宽度，最多显示两行 */}
                <div className="col-span-1 md:col-span-6 min-w-0 pr-4">
                  <div className="font-medium text-gray-800 line-clamp-2 leading-relaxed" title={item.problemText}>
                    {item.problemText}
                  </div>
                </div>

                {/* 标签区域：占据 3/12 宽度 */}
                <div className="col-span-1 md:col-span-3 flex flex-wrap gap-1.5 items-center min-w-0">
                  <Tag color={getErrorTypeColor(item.errorType)} className="m-0 border-none">
                    {item.errorType}
                  </Tag>
                  {item.knowledgePoint && (
                    <Tag color="blue" className="m-0 border-none truncate max-w-full" title={item.knowledgePoint}>
                      {item.knowledgePoint}
                    </Tag>
                  )}
                </div>

                {/* 时间区域：占据 2/12 宽度 */}
                <div className="col-span-1 md:col-span-2 text-slate-400 text-sm">
                  {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                </div>

                {/* 状态与Hover操作区域：占据 1/12 宽度 */}
                <div className="col-span-1 md:col-span-1 flex justify-start md:justify-center items-center relative min-h-[28px]">
                  <div className="transition-opacity duration-200 md:group-hover:opacity-0">
                    <Tag color={item.status === '已复习' ? 'emerald' : 'orange'} className="m-0 border-none">
                      {item.status}
                    </Tag>
                  </div>
                  <div className="hidden md:flex absolute inset-0 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span className="text-blue-600 text-sm font-bold whitespace-nowrap flex items-center">
                      复习 <RiseOutlined className="ml-1" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
