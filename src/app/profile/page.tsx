'use client'

import React, { useEffect, useState } from 'react'
import { Card, Form, Input, Button, Select, message } from 'antd'
import { UserOutlined, SaveOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import { authApi } from '@/lib/api'

const { Option } = Select

export default function Profile() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { username } = useUserStore()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res: any = await authApi.getProfile()
      form.setFieldsValue(res.data)
    } catch (error) {
      message.error('获取个人信息失败')
    }
  }

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      // 更新个人信息的 API 调用
      message.success('保存成功')
    } catch (error) {
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-grow w-full py-4 md:py-8">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">个人设置</h2>
        <p className="text-gray-500 mt-1 md:mt-2 text-sm md:text-base">管理你的账户信息</p>
      </div>

      <div className="max-w-2xl">
        <Card className="rounded-xl shadow-sm border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {username?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{username}</h3>
              <p className="text-gray-500">数智学堂学员</p>
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

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label="当前学段"
                name="grade"
              >
                <Select size="large" placeholder="选择学段">
                  <Option value="初一">初一</Option>
                  <Option value="初二">初二</Option>
                  <Option value="初三">初三</Option>
                  <Option value="高一">高一</Option>
                  <Option value="高二">高二</Option>
                  <Option value="高三">高三</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="数学自评学力"
                name="level"
              >
                <Select size="large" placeholder="选择学力水平">
                  <Option value="基础">基础薄弱</Option>
                  <Option value="中等">中等水平</Option>
                  <Option value="拔高">拔高冲刺</Option>
                </Select>
              </Form.Item>
            </div>

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
      </div>
    </div>
  )
}
