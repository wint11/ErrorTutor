import React, { useEffect } from 'react'
import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store/userStore'
import { BookOutlined, RiseOutlined, RobotOutlined } from '@ant-design/icons'

const Home: React.FC = () => {
  const navigate = useNavigate()
  const { token } = useUserStore()

  useEffect(() => {
    // 如果已经登录，直接跳转到控制台
    if (token) {
      navigate('/dashboard')
    }
  }, [token, navigate])

  return (
    <div className="flex flex-col flex-grow w-full">
      {/* Hero Section */}
      <section className="relative w-full bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-24 sm:py-32 flex flex-col items-center justify-center overflow-hidden">
        {/* 背景装饰元素 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-primary-200/20 blur-3xl rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-secondary-200/20 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-tight">
            不再害怕做错题<br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-secondary-500">
              让每次错误成为提分的阶梯
            </span>
          </h1>
          <p className="mt-4 text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-12 leading-relaxed">
            「数智学堂」全场景中学数学智能辅导平台。<br />
            我们不直接给答案，而是通过启发式对话，帮你揪出思维漏洞，真正掌握解题方法。
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button type="primary" size="large" className="h-14 px-10 text-lg font-bold bg-primary-600 hover:bg-primary-500 border-none shadow-lg shadow-primary-500/30 transition-all hover:-translate-y-1" onClick={() => navigate('/register')}>
              免费注册开始
            </Button>
            <Button size="large" className="h-14 px-10 text-lg font-bold text-slate-700 border-slate-300 hover:border-primary-500 hover:text-primary-600 transition-all hover:-translate-y-1" onClick={() => navigate('/login')}>
              已有账号登录
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white w-full flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">核心功能体验</h2>
            <p className="mt-4 text-xl text-slate-500">专为桌面端设计的沉浸式学习闭环</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all border border-slate-100 group">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-6 text-primary-500 text-3xl group-hover:scale-110 transition-transform">
                <BookOutlined />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">① 结构化题目解析</h3>
              <p className="text-slate-500 leading-relaxed">
                网页端支持快速文本录入，系统自动解析题干信息，拆解已知条件与所求问题，覆盖代数、几何等各类中学数学题型。
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all border border-slate-100 group">
              <div className="w-16 h-16 bg-secondary-100 rounded-2xl flex items-center justify-center mb-6 text-secondary-500 text-3xl group-hover:scale-110 transition-transform">
                <RobotOutlined />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">② 分步思维引导与诊断</h3>
              <p className="text-slate-500 leading-relaxed">
                四步引导法：理解题意 → 知识点映射 → 逻辑建模 → 求解验算。系统静默分析你的每一步输入，精准定位认知偏差。
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all border border-slate-100 group">
              <div className="w-16 h-16 bg-accent-100 rounded-2xl flex items-center justify-center mb-6 text-accent-500 text-3xl group-hover:scale-110 transition-transform">
                <RiseOutlined />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">③ 错题闭环与针对练习</h3>
              <p className="text-slate-500 leading-relaxed">
                错题自动归档，提供高亮标注与生活化类比讲解。针对你的特定错误类型，智能推送变式训练，确保彻底巩固。
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home