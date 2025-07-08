/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from 'next/headers'

// Cấu hình chung cho fetch
const baseOptions: RequestInit = {
  headers: {
    'Content-Type': 'application/json'
  }
}

export async function clientFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  
  const response = await fetch(url, {
    ...baseOptions,
    ...options,
    headers: {
      ...baseOptions.headers,
      ...options.headers
    }
  })

  const data = await response.json()

  if (!response.ok) {
    const error = new Error(data.message || `HTTP ${response.status}`)
    ;(error as any).status = response.status
    ;(error as any).data = data
    throw error
  }
  
  return data
}

export async function serverFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseApiUrl = process.env.API_URL
  if (!baseApiUrl) {
    throw new Error('API_URL không được cấu hình trong .env')
  }
  
  const url = `${baseApiUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  // Đọc cookie từ request trên server
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('accessToken')?.value
  console.log("🚀 serverFetch accessToken:", accessToken ? 'exists' : 'none')

  const headers = new Headers(baseOptions.headers)
  
  // Merge headers từ options
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers.set(key, value)
      })
    } else {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (value) headers.set(key, value)
      })
    }
  }

  // Set authorization header
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store' 
    })
    
    const data = await response.json()

    if (!response.ok) {
      const error = new Error(data.message || `HTTP ${response.status}`)
      ;(error as any).status = response.status
      ;(error as any).data = data
      throw error
    }
    
    return data
  } catch (error) {
    console.error('Server fetch error:', error)
    throw error
  }
}