import React, { useState } from 'react'
import { Form, Input, Button, message, Select } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import request from '../utils/request'

const { Option } = Select

const Register: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      await request.post('/auth/register', {
        username: values.username,
        password: values.password,
        grade: values.grade,
        level: values.level
      })
      message.success('注册成功，请登录')
      navigate('/login')
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 w-full">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          注册数智学堂
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          已有账号？{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
            立即登录
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

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                label="当前学段"
                name="grade"
                rules={[{ required: true, message: '请选择学段' }]}
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
                rules={[{ required: true, message: '请选择学力' }]}
              >
                <Select size="large" placeholder="选择学力水平">
                  <Option value="基础">基础薄弱</Option>
                  <Option value="中等">中等水平</Option>
                  <Option value="拔高">拔高冲刺</Option>
                </Select>
              </Form.Item>
            </div>

            <Form.Item className="mb-0 mt-4">
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                完成注册
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  )
}

export default Register