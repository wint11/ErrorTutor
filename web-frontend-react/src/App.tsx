import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import DefaultLayout from './layouts/DefaultLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Tutoring from './pages/Tutoring'
import Growth from './pages/Growth'
import Profile from './pages/Profile'
import { useUserStore } from './store/userStore'

// 简单的路由守卫组件
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useUserStore.getState().token
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <DefaultLayout />,
    children: [
      {
        path: '',
        element: <Home />
      },
      {
        path: 'dashboard',
        element: <ProtectedRoute><Dashboard /></ProtectedRoute>
      },
      {
        path: 'tutoring',
        element: <ProtectedRoute><Tutoring /></ProtectedRoute>
      },
      {
        path: 'tutoring/:id',
        element: <ProtectedRoute><Tutoring /></ProtectedRoute>
      },
      {
        path: 'growth',
        element: <ProtectedRoute><Growth /></ProtectedRoute>
      },
      {
        path: 'profile',
        element: <ProtectedRoute><Profile /></ProtectedRoute>
      }
    ]
  },
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/register',
    element: <Register />
  }
])

const App: React.FC = () => {
  return <RouterProvider router={router} />
}

export default App