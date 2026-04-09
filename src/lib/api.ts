import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

function getStoredToken() {
  if (typeof window === 'undefined') {
    return null
  }

  const persistedState = localStorage.getItem('user-storage')

  if (!persistedState) {
    return null
  }

  try {
    const parsed = JSON.parse(persistedState)
    return parsed.state?.token || null
  } catch {
    return null
  }
}

function isAuthRequest(url?: string) {
  return url === '/auth/login' || url === '/auth/register'
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  if (isAuthRequest(config.url)) {
    if (config.headers?.Authorization) {
      delete config.headers.Authorization
    }

    return config
  }

  const token = getStoredToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// 认证相关
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (username: string, password: string, grade?: string, level?: string, textbookVersion?: string, role?: string) =>
    api.post('/auth/register', { username, password, grade, level, textbookVersion, role }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: { grade?: string; level?: string; textbookVersion?: string; password?: string }) =>
    api.put('/auth/profile', data),
  generatePortrait: () => api.post('/auth/profile/portrait'),
}

// 辅导相关
export const tutoringApi = {
  createSession: (problemText: string, mode?: string, timeLimit?: number, difficulty?: string, groupId?: string, questionCount?: number, topic?: string, mistakeText?: string, knowledgePoint?: string, exerciseId?: string) =>
    api.post('/tutoring/sessions', { problemText, mode, timeLimit, difficulty, groupId, questionCount, topic, mistakeText, knowledgePoint, exerciseId }),
  getSession: (sessionId: string) => api.get(`/tutoring/sessions/${sessionId}`),
  getGroupSessions: (groupId: string) => api.get(`/tutoring/groups/${groupId}/sessions`),
  startSession: (sessionId: string) => api.post(`/tutoring/sessions/${sessionId}/start`),
  sendMessage: (sessionId: string, text: string) => {
    // Return fetch directly since axios doesn't natively support streaming well
    const token = getStoredToken()
    return fetch(`${API_BASE_URL}/tutoring/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ text })
    })
  },
  generateProblem: (data: { type: 'challenge' | 'practice', topic?: string, mode?: string, difficulty?: string, mistakeText?: string }) => 
    api.post('/tutoring/generate-problem', data),
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
  getExercises: () => api.get('/dashboard/exercises'),
}

// 教师端相关
export const teacherApi = {
  getDashboardStats: () => api.get('/teacher/dashboard/stats'),
  getClasses: () => api.get('/teacher/classes'),
  createClass: (name: string) => api.post('/teacher/classes', { name }),
  updateClass: (id: string, name: string) => api.put('/teacher/classes', { id, name }),
  deleteClass: (id: string) => api.delete(`/teacher/classes?id=${id}`),
  getStudents: (classId?: string) => api.get('/teacher/students', { params: { classId } }),
  batchCreateStudents: (data: { classId: string, count: number, grade?: string, level?: string, textbookVersion?: string }) => api.post('/teacher/students', data),
  updateStudent: (studentId: string, data: { username?: string, password?: string, classId?: string }) => api.put('/teacher/students', { studentId, ...data }),
  deleteStudent: (studentId: string) => api.delete('/teacher/students', { data: { studentId } }),
  getExercises: () => api.get('/teacher/exercises'),
  createExercise: (data: any) => api.post('/teacher/exercises', data),
}
