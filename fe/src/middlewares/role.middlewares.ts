import { IMiddleware, MiddlewareContext } from './type'
import { NextResponse } from 'next/server'

export const roleMiddleware: IMiddleware = {
  matcher: /^\/admin\/(users|settings)/,
  excluded: /^$/,

  handle: async (req, res, context: MiddlewareContext = {}) => {
    const user = context.user

    console.log("🔵 Role middleware - user:", user ? 'exists' : 'none')

    if (!user) {
      console.log("❌ No user in context")
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Kiểm tra role (ví dụ)
    if (user.role !== 'admin') {
      console.log("❌ Insufficient permissions")
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    console.log("✅ Role check passed")
    return res
  }
}