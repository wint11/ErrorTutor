'use client'

import React, { useState } from 'react'
import { Form, Input, Button, Checkbox, message } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { useUserStore } from '@/store/userStore'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { setToken, setUsername, setRole } = useUserStore()

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const res: any = await authApi.login(values.username, values.password)
      setToken(res.data.token)
      setUsername(res.data.username)
      if (res.data.role) {
        setRole(res.data.role)
      }
      message.success('登录成功')

      if (res.data.requirePasswordChange) {
        message.warning('系统检测到您使用的是默认密码，请先修改密码以确保账户安全', 5)
        router.push('/profile?action=change-password')
        return
      }

      if (res.data.role === 'TEACHER') {
        router.push('/teacher/dashboard')
      } else {
        if (!res.data.grade || !res.data.level) {
          message.info('请先完善个人信息')
          router.push('/profile')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 w-full">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          登录数智学堂
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          还没有账号？{' '}
          <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
            立即注册
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Form
            layout="vertical"
            onFinish={onFinish}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input size="large" placeholder="请输入用户名" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password size="large" placeholder="请输入密码" />
            </Form.Item>

            <div className="flex items-center justify-between mb-6">
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>记住我</Checkbox>
              </Form.Item>
              <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                忘记密码？
              </a>
            </div>

            <Form.Item className="mb-0">
              <Button type="primary" htmlType="submit" size="large" block loading={loading} className="bg-blue-600">
                登录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}
