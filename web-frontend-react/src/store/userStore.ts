import { create } from 'zustand'

interface UserState {
  token: string
  username: string
  setToken: (token: string) => void
  setUsername: (username: string) => void
  logout: () => void
}

export const useUserStore = create<UserState>((set) => ({
  token: localStorage.getItem('token') || '',
  username: localStorage.getItem('username') || '',
  setToken: (token) => {
    localStorage.setItem('token', token)
    set({ token })
  },
  setUsername: (username) => {
    localStorage.setItem('username', username)
    set({ username })
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    set({ token: '', username: '' })
  }
}))