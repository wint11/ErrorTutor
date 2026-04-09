'use client'

import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Button, Select, message, Spin, Typography, Tooltip } from 'antd'
import { UserOutlined, SaveOutlined, RobotOutlined, SyncOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import { authApi } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const { Option } = Select
const { Paragraph, Text } = Typography

export default function Profile() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [aiPortrait, setAiPortrait] = useState<string | null>(null)
  const [aiPortraitUpdatedAt, setAiPortraitUpdatedAt] = useState<string | null>(null)
  const [className, setClassName] = useState<string | null>(null)
  const { username, role } = useUserStore()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res: any = await authApi.getProfile()
      form.setFieldsValue(res.data)
      setAiPortrait(res.data.aiPortrait || null)
      setAiPortraitUpdatedAt(res.data.aiPortraitUpdatedAt || null)
      if (res.data.class && res.data.class.name) {
        setClassName(res.data.class.name)
      }
    } catch (error) {
      message.error('获取个人信息失败')
    }
  }

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const res: any = await authApi.updateProfile({
        grade: values.grade,
        level: values.level,
        textbookVersion: values.textbookVersion,
        password: values.password
      })
      message.success('保存成功')
      setAiPortrait(res.data.aiPortrait || null)
      setAiPortraitUpdatedAt(res.data.aiPortraitUpdatedAt || null)
      // 如果修改了密码，清空密码框
      if (values.password) {
        form.setFieldValue('password', undefined)
      }
    } catch (error) {
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePortrait = async () => {
    setGenerating(true)
    try {
      const res: any = await authApi.generatePortrait()
      setAiPortrait(res.data.aiPortrait)
      setAiPortraitUpdatedAt(res.data.aiPortraitUpdatedAt)
      message.success('AI 画像生成成功！')
    } catch (error: any) {
      const errMsg = error.response?.data?.error || '生成失败，请稍后重试'
      message.warning(errMsg)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="w-full p-4 md:p-6 max-w-7xl mx-auto flex flex-col h-auto lg:h-[calc(100vh-64px)]">
      <div className="mb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-gray-900">个人中心</h2>
        <p className="text-gray-500 mt-1 text-sm">管理账户信息与查看学习画像</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow min-h-0">
        {/* 左侧：个人设置 */}
        <Card 
          className="rounded-xl shadow-sm border-gray-100 h-full flex flex-col min-h-0"
          styles={{ body: { flexGrow: 1, overflowY: 'auto', minHeight: 0 } }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${role === 'TEACHER' ? 'bg-indigo-500' : 'bg-blue-500'}`}>
              {username?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{username}</h3>
              <p className="text-gray-500">
                {role === 'TEACHER' 
                  ? '数智学堂教师' 
                  : (className ? className : '数智学堂学员')}
              </p>
            </div>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
          >
            <Form.Item
              label="用户名"
              name="username"
            >
              <Input prefix={<UserOutlined />} disabled size="large" />
            </Form.Item>

            <Form.Item
              label="修改密码（选填，不修改请留空）"
              name="password"
              rules={[
                { min: 6, message: '密码至少为 6 个字符' }
              ]}
            >
              <Input.Password size="large" placeholder="请输入新密码" />
            </Form.Item>

            {role === 'STUDENT' && (
              <div className="grid grid-cols-2 gap-4">
                <Form.Item
                  label="当前学段"
                  name="grade"
                  rules={[{ required: true, message: '请选择当前学段' }]}
                >
                  <Select size="large" placeholder="选择学段">
                    <Option value="初一上">初一上</Option>
                    <Option value="初一下">初一下</Option>
                    <Option value="初二上">初二上</Option>
                    <Option value="初二下">初二下</Option>
                    <Option value="初三上">初三上</Option>
                    <Option value="初三下">初三下</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="教材版本"
                  name="textbookVersion"
                  rules={[{ required: true, message: '请选择教材版本' }]}
                >
                  <Select size="large" placeholder="选择教材版本">
                    <Option value="人教版">人教版</Option>
                    <Option value="浙教版">浙教版</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="数学自评学力"
                  name="level"
                  className="col-span-2"
                  rules={[{ required: true, message: '请选择自评学力' }]}
                >
                  <Select size="large" placeholder="选择学力水平">
                    <Option value="基础">基础薄弱</Option>
                    <Option value="中等">中等水平</Option>
                    <Option value="拔高">拔高冲刺</Option>
                  </Select>
                </Form.Item>
              </div>
            )}

            <Form.Item className="mb-0 mt-4">
              <Button 
                type="primary" 
                htmlType="submit" 
                size="large" 
                loading={loading}
                icon={<SaveOutlined />}
                className="bg-blue-600"
              >
                保存修改
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* 右侧：AI 画像卡片（仅学生可见） */}
        {role === 'STUDENT' && (
          <Card 
            className="rounded-xl shadow-sm border-blue-100 bg-gradient-to-br from-blue-50 to-white h-full flex flex-col min-h-0"
            styles={{ body: { flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } }}
          >
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <RobotOutlined className="text-2xl text-blue-500" />
                <h3 className="text-lg font-bold text-gray-900 m-0">AI 学习画像</h3>
              </div>
              <Tooltip title={(aiPortraitUpdatedAt && (new Date().getTime() - new Date(aiPortraitUpdatedAt).getTime()) <= 3 * 24 * 60 * 60 * 1000) ? "每 3 天仅允许更新一次画像" : ""}>
                <Button 
                  type="default" 
                  onClick={handleGeneratePortrait} 
                  loading={generating}
                  disabled={aiPortraitUpdatedAt ? (new Date().getTime() - new Date(aiPortraitUpdatedAt).getTime()) <= 3 * 24 * 60 * 60 * 1000 : false}
                  icon={<SyncOutlined />}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
                >
                  {aiPortrait ? '更新画像' : '生成画像'}
                </Button>
              </Tooltip>
            </div>
            
            {aiPortraitUpdatedAt && (
              <p className="text-xs text-gray-400 mb-4 flex-shrink-0">
                最后更新于：{new Date(aiPortraitUpdatedAt).toLocaleString()}
              </p>
            )}

            <div className="bg-white rounded-lg p-4 md:p-6 border border-blue-100 flex-grow overflow-y-auto relative custom-scrollbar">
              {generating ? (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <Spin size="large" />
                  <p className="text-blue-500 mt-4 text-sm font-medium animate-pulse">正在深度分析你的学习数据...</p>
                </div>
              ) : aiPortrait ? (
                <div className="prose prose-blue max-w-none text-gray-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiPortrait}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <RobotOutlined className="text-4xl mb-2 opacity-50" />
                  <p>点击上方按钮，让 AI 为你生成专属学习画像</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 教师专属提示卡片 */}
        {role === 'TEACHER' && (
          <Card 
            className="rounded-xl shadow-sm border-indigo-100 bg-gradient-to-br from-indigo-50 to-white h-full flex flex-col min-h-0"
            styles={{ body: { flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } }}
          >
            <div className="flex flex-col items-center justify-center h-full text-indigo-400 py-8">
              <UserOutlined className="text-6xl mb-6 text-indigo-300" />
              <h3 className="text-xl font-bold text-indigo-900 mb-2">教师专属通道</h3>
              <p className="text-center text-indigo-500/80 px-8">
                您可以在教师控制台管理所有班级和学生，并为他们布置智能练习。这里仅用于修改您的基础账户信息。
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
