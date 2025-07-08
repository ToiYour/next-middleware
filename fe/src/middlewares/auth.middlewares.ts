import { IMiddleware, MiddlewareContext } from './type'
import { NextResponse } from 'next/server'

export const authApiMiddleware: IMiddleware = {
  matcher: /^\/admin/,
  excluded: /^\/login$/,

  handle: async (req, res, context: MiddlewareContext = {}) => {
    // Lấy token từ context (ưu tiên) hoặc từ cookie
    const accessToken = context.accessToken ?? req.cookies.get('accessToken')?.value
    console.log("🚀 ~ handle: ~ accessToken:", accessToken)
    
    console.log("🔵 Auth middleware - token:", accessToken ? 'exists' : 'none')

    if (!accessToken) {
      console.log("❌ No access token found")
      return NextResponse.redirect(new URL('/login', req.url))
    }

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      
      if (payload.exp < now) {
        console.log("❌ Token expired")
        return NextResponse.redirect(new URL('/login', req.url))
      }

      // Lưu user info vào context cho middleware khác sử dụng
      context.user = payload
      console.log("✅ Auth successful for user:", payload.email || payload.sub)

    } catch (err) {
      console.log("❌ Token parsing failed:", err)
      return NextResponse.redirect(new URL('/login', req.url))
    }

    return res
  }
}