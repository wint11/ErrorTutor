'use client'

import React, { useEffect, useState } from 'react'
import { Typography, Tag, Spin } from 'antd'
import { TeamOutlined, FileTextOutlined, AppstoreAddOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import { teacherApi } from '@/lib/api'
import { useUserStore } from '@/store/userStore'
import { useRouter } from 'next/navigation'

const { Title, Text } = Typography

export default function TeacherDashboard() {
  const { username } = useUserStore()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    classCount: 0,
    studentCount: 0,
    exerciseCount: 0,
    recentExercises: [] as any[]
  })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await teacherApi.getDashboardStats()
        setStats(res.data)
      } catch (error) {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* 欢迎横幅区 */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 sm:p-10 shadow-lg text-white">
          <div className="relative z-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
              您好，{username} 老师！
            </h1>
            <p className="text-blue-100 text-lg sm:text-xl font-medium opacity-90 max-w-2xl">
              欢迎来到数智学堂。随时掌控班级动态，轻松发布智能练习。
            </p>
          </div>
          {/* 背景装饰圆环 */}
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-32 translate-y-12 w-48 h-48 bg-indigo-300 opacity-20 rounded-full blur-2xl"></div>
        </div>

        {/* 核心数据区 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl shadow-inner">
              <AppstoreAddOutlined />
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">管理的班级总数</p>
              <p className="text-3xl font-black text-slate-800">{stats.classCount}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-3xl shadow-inner">
              <TeamOutlined />
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">学生总数 (人)</p>
              <p className="text-3xl font-black text-slate-800">{stats.studentCount}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-3xl shadow-inner">
              <FileTextOutlined />
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">累计发布练习 (份)</p>
              <p className="text-3xl font-black text-slate-800">{stats.exerciseCount}</p>
            </div>
          </div>
        </div>

        {/* 快捷操作与动态区 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 左侧：最近发布的练习 */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-xl font-bold text-slate-800 m-0">最近发布的练习</h2>
              <button 
                onClick={() => router.push('/teacher/exercises')}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1 transition-colors"
              >
                查看全部 <RightOutlined className="text-xs" />
              </button>
            </div>
            
            <div className="p-0 flex-1">
              {loading ? (
                <div className="flex justify-center items-center h-48">
                  <Spin size="large" />
                </div>
              ) : stats.recentExercises.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {stats.recentExercises.map((item, index) => (
                    <div key={index} className="px-6 py-5 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                          <FileTextOutlined />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <TeamOutlined /> {item.class?.name}
                            </span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span>截止: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '无限制'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Tag color="blue" className="px-3 py-1 text-sm rounded-full border-none bg-blue-50 text-blue-600 font-medium mr-0">
                          {item._count?.submissions || 0} 人已提交
                        </Tag>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <FileTextOutlined className="text-5xl mb-4 text-slate-200" />
                  <p>暂无发布的练习，快去新建一个吧！</p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：快捷操作 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-24">
              <h2 className="text-xl font-bold text-slate-800 mb-6">快捷操作</h2>
              <div className="flex flex-col gap-4">
                
                <button 
                  onClick={() => router.push('/teacher/exercises')}
                  className="w-full group relative flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm">
                    <PlusOutlined />
                  </div>
                  <span className="text-lg font-bold tracking-wide">发布新练习</span>
                  <RightOutlined className="absolute right-6 opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300" />
                </button>

                <button 
                  onClick={() => router.push('/teacher/students')}
                  className="w-full group flex items-center gap-4 p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 transition-all duration-200"
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl text-indigo-600">
                    <TeamOutlined />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-base font-bold">一键生成学生</span>
                    <span className="text-xs text-indigo-500 font-medium">自动生成全班账号密码</span>
                  </div>
                </button>

                <button 
                  onClick={() => router.push('/teacher/students')}
                  className="w-full group flex items-center gap-4 p-4 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 transition-all duration-200"
                >
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl text-purple-600">
                    <AppstoreAddOutlined />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-base font-bold">创建新班级</span>
                    <span className="text-xs text-purple-500 font-medium">管理不同的教学班级</span>
                  </div>
                </button>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
