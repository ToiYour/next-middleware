import { IMiddleware } from './type'
import { NextResponse } from 'next/server'

export const authApiMiddleware: IMiddleware = {
  matcher: /^\/admin/,
  excluded: /^\/login$/,

  handle: async (req, res) => {
    const accessToken =  req.cookies.get('accessToken')?.value|| res?.cookies.get('accessToken')?.value
    console.log("🚀 ~ handle: ~ accessToken:", accessToken)


    if (!accessToken) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        return NextResponse.redirect(new URL('/login', req.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    return res
  }
}
