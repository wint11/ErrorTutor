export interface User {
  id: string
  username: string
  grade?: string
  level?: string
}

export interface TutoringSession {
  id: string
  userId: string
  problemText: string
  mode: string
  status: string
  currentStep: number
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'ai'
  text: string
  createdAt: string
}

export interface MistakeRecord {
  id: string
  userId: string
  problemText: string
  errorType: string
  knowledgePoint: string
  status: string
  createdAt: string
}

export interface GrowthData {
  date: string
  problemsSolved: number
  accuracy: number
}

export interface DashboardStats {
  totalProblems: number
  accuracy: number
  streakDays: number
  weeklyGrowth: GrowthData[]
}
