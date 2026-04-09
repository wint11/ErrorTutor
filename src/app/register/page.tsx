'use client'

import React, { useState } from 'react'
import { Form, Input, Button, message, Select } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'

const { Option } = Select

export default function Register() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      await authApi.register(
        values.username,
        values.password,
        values.role === 'TEACHER' ? undefined : values.grade,
        values.role === 'TEACHER' ? undefined : values.level,
        values.role === 'TEACHER' ? undefined : values.textbookVersion,
        values.role
      )
      message.success('注册成功，请登录')
      router.push('/login')
    } catch (error: any) {
      message.error(error.response?.data?.error || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 w-full">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          注册数智学堂
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          已有账号？{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            立即登录
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Form
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ role: 'STUDENT', textbookVersion: '人教版' }}
          >
            <Form.Item
              label="角色"
              name="role"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select size="large" placeholder="选择角色">
                <Option value="STUDENT">学生</Option>
                <Option value="TEACHER">教师</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, max: 20, message: '长度在 3 到 20 个字符' }
              ]}
            >
              <Input size="large" placeholder="请输入用户名" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度不能小于6位' }
              ]}
            >
              <Input.Password size="large" placeholder="请输入密码" />
            </Form.Item>

            <Form.Item
              label="确认密码"
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次输入密码不一致!'))
                  }
                })
              ]}
            >
              <Input.Password size="large" placeholder="请再次输入密码" />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.role !== currentValues.role}>
              {({ getFieldValue }) =>
                getFieldValue('role') === 'STUDENT' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                      label="当前学段"
                      name="grade"
                      rules={[{ required: true, message: '请选择学段' }]}
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
                      rules={[{ required: true, message: '请选择学力' }]}
                      className="col-span-2"
                    >
                      <Select size="large" placeholder="选择学力水平">
                        <Option value="基础">基础薄弱</Option>
                        <Option value="中等">中等水平</Option>
                        <Option value="拔高">拔高冲刺</Option>
                      </Select>
                    </Form.Item>
                  </div>
                ) : null
              }
            </Form.Item>

            <Form.Item className="mb-0 mt-4">
              <Button type="primary" htmlType="submit" size="large" block loading={loading} className="bg-blue-600">
                完成注册
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}
