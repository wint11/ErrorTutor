'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  token: string
  username: string
  role: string
  setToken: (token: string) => void
  setUsername: (username: string) => void
  setRole: (role: string) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      token: '',
      username: '',
      role: '',
      setToken: (token) => set({ token }),
      setUsername: (username) => set({ username }),
      setRole: (role) => set({ role }),
      logout: () => set({ token: '', username: '', role: '' }),
    }),
    {
      name: 'user-storage',
    }
  )
)
