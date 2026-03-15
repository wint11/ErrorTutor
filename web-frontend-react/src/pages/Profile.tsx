import React, { useState, useEffect } from 'react'
import { Card, Typography, Descriptions, Tag, Button, Avatar, Spin, message } from 'antd'
import { useUserStore } from '../store/userStore'
import request from '../utils/request'

const { Title } = Typography

interface UserProfile {
  username: string
  grade: string | null
  level: string | null
  createdAt: string
}

const Profile: React.FC = () => {
  const { username } = useUserStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const data = await request.get<any, UserProfile>('/user/profile')
      setProfile(data)
    } catch (error) {
      console.error('获取用户信息失败', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未知'
    const date = new Date(dateString)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="flex-grow w-full py-8">
      <Card className="rounded-xl shadow-sm border-slate-100 max-w-4xl mx-auto">
        <Spin spinning={loading}>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mb-8">
            <Avatar size={100} style={{ backgroundColor: '#0ea5e9', fontSize: '2.5rem' }}>
              {username?.charAt(0)?.toUpperCase()}
            </Avatar>
            <div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{username}</h3>
              <div className="flex gap-2">
                <Tag color="blue">{profile?.grade || '暂无学段信息'}</Tag>
                <Tag color="cyan">{profile?.level || '暂无学力信息'}</Tag>
              </div>
            </div>
            <div className="ml-auto mt-4 md:mt-0">
              <Button type="primary" ghost>编辑个人资料</Button>
            </div>
          </div>

          <Descriptions title="基本信息" bordered column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
            <Descriptions.Item label="用户名">{username}</Descriptions.Item>
            <Descriptions.Item label="注册时间">{formatDate(profile?.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="当前学段">{profile?.grade || '未设置'}</Descriptions.Item>
            <Descriptions.Item label="学力评估">{profile?.level || '未设置'}</Descriptions.Item>
          </Descriptions>
        </Spin>
      </Card>
    </div>
  )
}

export default Profile