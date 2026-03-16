'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  token: string
  username: string
  setToken: (token: string) => void
  setUsername: (username: string) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      token: '',
      username: '',
      setToken: (token) => set({ token }),
      setUsername: (username) => set({ username }),
      logout: () => set({ token: '', username: '' }),
    }),
    {
      name: 'user-storage',
    }
  )
)
