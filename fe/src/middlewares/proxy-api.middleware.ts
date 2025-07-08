import { IMiddleware, MiddlewareContext } from './type'
import { NextResponse } from 'next/server'

export const proxyApiMiddleware: IMiddleware = {
  matcher: /^\/api\//,
  excluded: /^\/api\/(auth|refresh-token|health)$/,

  handle: async (req, res, context: MiddlewareContext = {}) => {
    // Lấy token từ context (đã refresh) hoặc từ cookie/header
    const accessToken = 
      context.accessToken ||
      req.cookies.get('accessToken')?.value ||
      req.headers.get('x-access-token') ||
      req.headers.get('authorization')?.replace('Bearer ', '')

    console.log("🔵 Proxy middleware - token:", accessToken ? 'exists' : 'none')

    const pathName = req.nextUrl.pathname.replace(/^\/api\//, "")
    const searchParams = req.nextUrl.searchParams.toString()
    const baseApiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL

    if (!baseApiUrl) {
      console.error("❌ API_URL not configured")
      return NextResponse.json(
        { error: 'API_URL not configured' }, 
        { status: 500 }
      )
    }

    // Tạo target URL
    const target = new URL(baseApiUrl)
    target.pathname = `${target.pathname.replace(/\/$/, '')}/${pathName}`
    
    if (searchParams) {
      target.search = searchParams
    }

    console.log("🚀 Proxying to:", target.toString())

    // Tạo headers cho request
    const headers = new Headers()
    
    // Copy headers từ request gốc (trừ một số headers không cần thiết)
    const excludedHeaders = ['host', 'connection', 'content-length']
    req.headers.forEach((value, key) => {
      if (!excludedHeaders.includes(key.toLowerCase())) {
        headers.set(key, value)
      }
    })

    // Set authorization header nếu có token
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`)
    }

    // Set content-type nếu chưa có
    if (!headers.has('content-type') && req.method !== 'GET') {
      headers.set('Content-Type', 'application/json')
    }

    // Rewrite request
    return NextResponse.rewrite(target, { 
      headers,
      request: {
        headers
      }
    })
  }
}