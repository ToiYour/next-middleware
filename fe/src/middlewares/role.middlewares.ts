import { IMiddleware } from './type'
import { NextResponse } from 'next/server'

export const roleMiddleware: IMiddleware = {
  matcher: /^\/admin/,
  excluded: /^\/login$/,

  handle: async (req, res) => {
    const accessToken =  req.cookies.get('accessToken')?.value|| res?.cookies.get('accessToken')?.value
    if (!accessToken) return NextResponse.redirect(new URL('/login', req.url))

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      console.log("🚀 ~ handle: ~ payload:", payload)

      if (payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    return res
  }
}
