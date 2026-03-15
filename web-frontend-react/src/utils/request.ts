import axios from 'axios'
import { useUserStore } from '../store/userStore'
import { message } from 'antd'

const request = axios.create({
  baseURL: 'http://localhost:3000/api', // Node.js backend
  timeout: 5000
})

request.interceptors.request.use(
  config => {
    const token = useUserStore.getState().token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  response => response.data,
  error => {
    message.error(error.response?.data?.error || '请求失败')
    return Promise.reject(error)
  }
)

export default request
