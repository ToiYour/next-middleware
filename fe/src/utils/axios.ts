/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

// Tạo axios instance cho client
const clientAxios = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Tạo axios instance cho server
const serverAxios = axios.create({
  baseURL: process.env.API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor cho client axios
clientAxios.interceptors.request.use(
  (config) => {
    console.log('🔵 Client axios request:', config.url)
    return config
  },
  (error) => {
    console.error('❌ Client axios request error:', error)
    return Promise.reject(error)
  }
)

clientAxios.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log('✅ Client axios response:', response.status)
    return response
  },
  (error) => {
    console.error('❌ Client axios response error:', error.response?.status, error.response?.data)
    return Promise.reject(error)
  }
)

// Interceptor cho server axios
serverAxios.interceptors.request.use(
  async (config) => {
    // Thêm token vào header cho server requests
    if (typeof window === 'undefined') {
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const accessToken = cookieStore.get('accessToken')?.value
      
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
    }
    
    console.log('🔵 Server axios request:', config.url)
    return config
  },
  (error) => {
    console.error('❌ Server axios request error:', error)
    return Promise.reject(error)
  }
)

serverAxios.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log('✅ Server axios response:', response.status)
    return response
  },
  (error) => {
    console.error('❌ Server axios response error:', error.response?.status, error.response?.data)
    return Promise.reject(error)
  }
)

// Client axios functions
export async function clientAxiosFetch<T>(
  endpoint: string,
  options: AxiosRequestConfig = {}
): Promise<T> {
  const response = await clientAxios.request<T>({
    url: endpoint,
    ...options
  })
  return response.data
}

export async function clientAxiosPost<T>(
  endpoint: string,
  data?: any,
  options: AxiosRequestConfig = {}
): Promise<T> {
  const response = await clientAxios.post<T>(endpoint, data, options)
  return response.data
}

export async function clientAxiosGet<T>(
  endpoint: string,
  options: AxiosRequestConfig = {}
): Promise<T> {
  const response = await clientAxios.get<T>(endpoint, options)
  return response.data
}

export async function clientAxiosPut<T>(
  endpoint: string,
  data?: any,
  options: AxiosRequestConfig = {}
): Promise<T> {
  const response = await clientAxios.put<T>(endpoint, data, options)
  return response.data
}

export async function clientAxiosDelete<T>(
  endpoint: string,
  options: AxiosRequestConfig = {}
): Promise<T> {
  const response = await clientAxios.delete<T>(endpoint, options)
  return response.data
}

// Server axios functions
export async function serverAxiosFetch<T>(
  endpoint: string,
  options: AxiosRequestConfig = {}
): Promise<T> {
  const response = await serverAxios.request<T>({
    url: endpoint,
    ...options
  })
  return response.data
}

export async function serverAxiosPost<T>(
  endpoint: string,
  data?: any,
  options: AxiosRequestConfig = {}
): Promise<T> {
  const response = await serverAxios.post<T>(endpoint, data, options)
  return response.data
}

export async function serverAxiosGet<T>(
  endpoint: string,
  options: AxiosRequestConfig = {}
): Promise<T> {
  const response = await serverAxios.get<T>(endpoint, options)
  return response.data
}