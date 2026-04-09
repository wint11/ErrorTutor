'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button, Menu, Avatar, Dropdown, Drawer } from 'antd'
import { UserOutlined, LogoutOutlined, MenuOutlined, AppstoreOutlined, RobotOutlined, LineChartOutlined, BookOutlined, TeamOutlined, FileTextOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'

const studentMenuItems = [
  { key: '/dashboard', label: '学习中心', icon: <AppstoreOutlined /> },
  { key: '/tutoring', label: '智能辅导', icon: <RobotOutlined /> },
  { key: '/growth', label: '成长轨迹', icon: <LineChartOutlined /> },
  { key: '/knowledge', label: '知识图谱', icon: <BookOutlined /> },
]

const teacherMenuItems = [
  { key: '/teacher/dashboard', label: '教师控制台', icon: <AppstoreOutlined /> },
  { key: '/teacher/students', label: '班级与学生管理', icon: <TeamOutlined /> },
  { key: '/teacher/exercises', label: '练习管理', icon: <FileTextOutlined /> },
]

export default function Navbar() {
  const { token, username, role, logout } = useUserStore()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const menuItems = role === 'TEACHER' ? teacherMenuItems : studentMenuItems

  const handleLogout = () => {
    logout()
    // 清除 cookie
    document.cookie = 'token=; path=/; max-age=0'
    router.push('/login')
  }

  const selectedKey = menuItems.find(item => pathname?.startsWith(item.key))?.key || (role === 'TEACHER' ? '/teacher/dashboard' : '/dashboard')

  const userMenu = {
    items: [
      {
        key: 'profile',
        label: <Link href="/profile">个人信息</Link>,
        icon: <UserOutlined />,
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        label: '退出登录',
        icon: <LogoutOutlined />,
        danger: true,
        onClick: handleLogout,
      },
    ],
  }

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center w-full">
          {/* 左侧：Logo & 桌面端导航菜单 */}
          <div className="flex items-center md:space-x-10">
            <Link href="/" className="hover:opacity-80 flex items-center transition-opacity gap-3 group">
              <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold transform group-hover:scale-110 transition-transform duration-300">
                数
              </div>
              <span className="text-xl md:text-2xl font-black tracking-tighter text-blue-600">
                数智学堂
              </span>
            </Link>
            {token && (
              <div className="hidden md:block">
                <Menu 
                  mode="horizontal" 
                  selectedKeys={[selectedKey]} 
                  items={menuItems} 
                  onClick={({ key }) => router.push(key)}
                  className="border-none bg-transparent min-w-[360px] font-medium text-slate-600"
                />
              </div>
            )}
          </div>
          
          {/* 右侧：用户区 & 移动端汉堡菜单 */}
          <div className="flex items-center space-x-2 md:space-x-4">
            {token ? (
              <>
                <Dropdown menu={userMenu} placement="bottomRight" arrow>
                  <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 px-2 md:px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-slate-200">
                    <Avatar size="small" style={{ backgroundColor: '#0ea5e9' }}>
                      {username?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <span className="hidden sm:inline text-sm font-medium text-slate-700">
                      {username}
                    </span>
                  </div>
                </Dropdown>
                {/* 移动端菜单按钮 */}
                <Button 
                  type="text" 
                  icon={<MenuOutlined className="text-xl" />} 
                  className="md:hidden flex items-center justify-center text-slate-600"
                  onClick={() => setMobileMenuOpen(true)}
                />
              </>
            ) : (
              <>
                <Button type="text" onClick={() => router.push('/login')} className="hidden sm:inline-flex font-medium text-gray-600 hover:text-blue-600">
                  登录账号
                </Button>
                <Button type="primary" onClick={() => router.push('/register')} className="font-medium rounded-lg shadow-md shadow-blue-200 bg-blue-500">
                  免费注册
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 移动端抽屉菜单 */}
      <Drawer
        title={<span className="text-blue-600 font-bold">数智学堂</span>}
        placement="right"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        size="default"
        styles={{ body: { padding: 0 } }}
      >
        <Menu 
          mode="vertical" 
          selectedKeys={[selectedKey]} 
          items={menuItems} 
          onClick={({ key }) => {
            router.push(key)
            setMobileMenuOpen(false)
          }}
          className="border-none font-medium text-slate-600"
        />
      </Drawer>
    </header>
  )
}
