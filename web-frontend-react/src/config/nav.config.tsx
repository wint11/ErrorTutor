import React from 'react'
import { AppstoreOutlined, RobotOutlined, LineChartOutlined } from '@ant-design/icons'

export interface NavMenuItem {
  key: string
  label: string
  icon?: React.ReactNode
  path: string
  roles?: string[] // 用于未来可能的权限控制 (如 'student', 'teacher', 'admin')
}

// 全局导航配置 (四个字原则)
export const mainNavConfig: NavMenuItem[] = [
  {
    key: 'dashboard',
    label: '学习中心',
    icon: <AppstoreOutlined />,
    path: '/dashboard'
  },
  {
    key: 'tutoring',
    label: '智能辅导',
    icon: <RobotOutlined />,
    path: '/tutoring'
  },
  {
    key: 'growth',
    label: '成长轨迹',
    icon: <LineChartOutlined />,
    path: '/growth'
  }
]

