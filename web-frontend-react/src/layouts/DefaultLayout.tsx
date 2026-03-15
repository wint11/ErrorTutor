import React, { useMemo, useState } from 'react'
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom'
import { Button, Menu, Avatar, Dropdown, Drawer } from 'antd'
import { UserOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons'
import { useUserStore } from '../store/userStore'
import { mainNavConfig } from '../config/nav.config'

const DefaultLayout: React.FC = () => {
  const { token, username, logout } = useUserStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // 根据配置文件生成 Ant Design 的 Menu items
  const menuItems = useMemo(() => {
    return mainNavConfig.map(item => ({
      key: item.path,
      icon: item.icon,
      label: item.label
    }))
  }, [])

  // 匹配当前路由以高亮菜单
  const selectedKey = useMemo(() => {
    const match = mainNavConfig.find(item => location.pathname.startsWith(item.path))
    return match ? match.path : '/dashboard'
  }, [location.pathname])

  const userMenu = {
    items: [
      {
        key: 'profile',
        label: '个人设置',
        icon: <UserOutlined />,
        onClick: () => navigate('/profile'),
      },
      {
        type: 'divider',
      },
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
    <div className="min-h-screen bg-gray-50 flex flex-col w-full font-sans">
      {/* 导航栏：统一使用 max-w-7xl 和相同的 padding 保证栅格对齐 */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-slate-100 flex-none">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center w-full">
            {/* 左侧：Logo & 桌面端导航菜单 */}
            <div className="flex items-center md:space-x-10">
              <Link to="/" className="hover:opacity-80 flex items-center transition-opacity gap-3 group">
                <img src="/logo.svg" alt="数智学堂 Logo" className="h-8 w-8 object-contain transform group-hover:scale-110 transition-transform duration-300" />
                <span className="text-xl md:text-2xl font-black tracking-tighter text-primary-600">
                  数智学堂
                </span>
              </Link>
              {token && (
                <div className="hidden md:block">
                  <Menu 
                    mode="horizontal" 
                    selectedKeys={[selectedKey]} 
                    items={menuItems} 
                    onClick={({ key }) => navigate(key)}
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
                  <Button type="text" onClick={() => navigate('/login')} className="hidden sm:inline-flex font-medium text-gray-600 hover:text-primary-600">
                    登录账号
                  </Button>
                  <Button type="primary" onClick={() => navigate('/register')} className="font-medium rounded-lg shadow-md shadow-primary-200">
                    免费注册
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 移动端抽屉菜单 */}
      <Drawer
        title={<span className="text-primary-600 font-bold">数智学堂</span>}
        placement="right"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={250}
        bodyStyle={{ padding: 0 }}
      >
        <Menu 
          mode="vertical" 
          selectedKeys={[selectedKey]} 
          items={menuItems} 
          onClick={({ key }) => {
            navigate(key)
            setMobileMenuOpen(false)
          }}
          className="border-none font-medium text-slate-600"
        />
      </Drawer>

      {/* 主体内容区：保证和 Header 宽度及 padding 一致 */}
      <main className="flex-grow w-full flex flex-col items-center">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col flex-grow">
          <Outlet />
        </div>
      </main>

      {location.pathname === '/' && (
        <footer className="bg-white border-t border-gray-200 flex-none">
          <div className="max-w-7xl mx-auto w-full py-6 md:py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="bg-gray-200 text-gray-600 rounded px-2 py-1 text-xs font-bold">数智学堂</span>
                <span className="text-gray-500 text-xs md:text-sm font-medium">个性化错题驱动学习平台</span>
              </div>
              <p className="text-center text-gray-400 text-xs md:text-sm m-0">
                &copy; {new Date().getFullYear()} 数智学堂. Designed for Education.
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

export default DefaultLayout