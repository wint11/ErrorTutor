import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is not set')
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器添加 token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('user-storage')
    if (token) {
      try {
        const parsed = JSON.parse(token)
        if (parsed.state?.token) {
          config.headers.Authorization = `Bearer ${parsed.state.token}`
        }
      } catch (e) {
        // ignore parse error
      }
    }
  }
  return config
})

// 认证相关
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (username: string, password: string, grade?: string, level?: string) =>
    api.post('/auth/register', { username, password, grade, level }),
  getProfile: () => api.get('/auth/profile'),
}

// 辅导相关
export const tutoringApi = {
  createSession: (problemText: string, mode?: string, timeLimit?: number) =>
    api.post('/tutoring/sessions', { problemText, mode, timeLimit }),
  getSession: (sessionId: string) => api.get(`/tutoring/sessions/${sessionId}`),
  sendMessage: (sessionId: string, text: string) =>
    api.post(`/tutoring/sessions/${sessionId}/messages`, { text }),
  getMessages: (sessionId: string) => api.get(`/tutoring/sessions/${sessionId}/messages`),
  getHistory: () => api.get('/tutoring/history'),
  getRecommend: () => api.get('/tutoring/recommend'),
}

// 成长相关
export const growthApi = {
  getStats: () => api.get('/growth/stats'),
  getMistakes: () => api.get('/growth/mistakes'),
}

// 仪表盘
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
}
