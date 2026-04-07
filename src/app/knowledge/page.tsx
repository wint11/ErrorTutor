'use client'

import React, { useState, useEffect } from 'react'
import { Card, Tree, Select, Typography, Tag, Spin, Empty } from 'antd'
import { BookOutlined, CheckCircleFilled, WarningFilled } from '@ant-design/icons'

const { Title, Text } = Typography
const { Option } = Select

export default function KnowledgeGraph() {
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState('zhejiang')
  const [grade, setGrade] = useState('7a')
  const [treeData, setTreeData] = useState<any[]>([])
  const [nodeStats, setNodeStats] = useState<Record<string, any>>({})

  useEffect(() => {
    loadKnowledgeData()
  }, [version, grade])

  const loadKnowledgeData = async () => {
    setLoading(true)
    try {
      // 动态导入对应的 JSON 数据
      const data = await import(`@/data/${version}-${grade}.json`)
      
      // 获取用户节点统计数据
      let statsMap: Record<string, any> = {}
      try {
        const token = localStorage.getItem('user-storage') ? JSON.parse(localStorage.getItem('user-storage') || '{}').state?.token : ''
        if (token) {
          const res = await fetch('/api/knowledge/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (res.ok) {
            const statsData = await res.json()
            statsData.forEach((stat: any) => {
              statsMap[stat.nodeId] = stat
            })
          }
        }
      } catch (e) {
        console.error('获取知识图谱统计失败', e)
      }
      
      setNodeStats(statsMap)
      const formattedTree = formatTreeData(data.nodes, statsMap)
      setTreeData(formattedTree)
    } catch (error) {
      console.error('加载知识图谱失败', error)
      setTreeData([])
    } finally {
      setLoading(false)
    }
  }

  // 递归格式化树数据以适配 antd Tree 组件
  const formatTreeData = (nodes: any[], statsMap: Record<string, any>): any[] => {
    return nodes.map(node => {
      const stat = statsMap[node.id] || { errorCount: 0, totalPracticed: 0, isMastered: false }
      const errorRate = stat.totalPracticed > 0 ? (stat.errorCount / stat.totalPracticed) * 100 : 0
      
      // 错误率超过 30% 且练习次数大于 0 时，视为薄弱环节
      const isWeak = errorRate > 30 && stat.totalPracticed > 0
      const isMastered = stat.isMastered || (stat.totalPracticed > 0 && !isWeak)
      
      const titleNode = (
        <div className="flex items-center gap-3 py-1 group">
          <Text className={
            isWeak ? 'text-red-600 font-bold' : 
            isMastered ? 'text-emerald-600 font-bold' : 
            'text-slate-700'
          }>
            {node.chapter ? `${node.chapter}：${node.title}` : node.title}
          </Text>
          
          {isWeak && (
            <Tag color="error" className="m-0 border-none px-2 rounded-full flex items-center gap-1 opacity-90">
              <WarningFilled /> 薄弱点 (错 {stat.errorCount} 次)
            </Tag>
          )}
          
          {isMastered && !isWeak && <CheckCircleFilled className="text-emerald-500" />}
          
          {stat.totalPracticed > 0 && !isWeak && !isMastered && (
            <span className="text-xs text-slate-400">已练习 {stat.totalPracticed} 次</span>
          )}
        </div>
      )

      return {
        title: titleNode,
        key: node.id,
        children: node.children && node.children.length > 0 ? formatTreeData(node.children, statsMap) : undefined,
        isLeaf: !node.children || node.children.length === 0,
      }
    })
  }

  return (
    <div className="max-w-5xl mx-auto w-full py-8">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Title level={2} className="!m-0 flex items-center">
            <BookOutlined className="mr-3 text-blue-600" />
            数学知识图谱
          </Title>
          <Text type="secondary" className="mt-2 block">
            点亮你的知识树，掌握的知识点会自动打勾标记
          </Text>
        </div>
        
        <div className="flex gap-4">
          <Select 
            value={version} 
            onChange={setVersion} 
            className="w-32" 
            size="large"
          >
            <Option value="renjiao">人教版</Option>
            <Option value="zhejiang">浙教版</Option>
          </Select>
          <Select 
            value={grade} 
            onChange={setGrade} 
            className="w-32" 
            size="large"
          >
            <Option value="7a">初一上</Option>
            <Option value="7b">初一下</Option>
            <Option value="8a">初二上</Option>
            <Option value="8b">初二下</Option>
            <Option value="9a">初三上</Option>
            <Option value="9b">初三下</Option>
          </Select>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100 min-h-[500px]">
        {loading ? (
          <div className="flex justify-center items-center h-[400px]">
            <Spin size="large" description="正在加载知识图谱..." />
          </div>
        ) : treeData.length > 0 ? (
          <div className="p-4 bg-slate-50/50 rounded-xl">
            <Tree
              showLine
              switcherIcon={<BookOutlined />}
              defaultExpandAll
              treeData={treeData}
              className="bg-transparent text-base"
            />
          </div>
        ) : (
          <Empty 
            description="暂无该版本学段的知识图谱数据" 
            className="py-20"
          />
        )}
      </Card>
    </div>
  )
}