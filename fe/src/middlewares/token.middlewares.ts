import { NextRequest, NextResponse } from 'next/server'
import { IMiddleware } from './type'

export const tokenApiMiddleware: IMiddleware = {
  matcher: /.*/,
  excluded: /^$/,

  handle: async (req: NextRequest,res:NextResponse) => {
    const accessToken = req.cookies.get('accessToken')?.value
    const refreshToken = req.cookies.get('refreshToken')?.value

    if (!refreshToken) return res

    let isExpired = false

    if (accessToken) {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]))
        const now = Math.floor(Date.now() / 1000)
        isExpired = payload.exp < now
      } catch {
        isExpired = true
      }
    } else {
      isExpired = true
    }

    if (!isExpired) return res

    try {
      const refreshRes = await fetch('http://localhost:3000/api/refresh-token', {
        method: 'POST',
        headers: {
          Cookie: `refreshToken=${refreshToken}`,
        },
        credentials: 'include',
      })

      const data = await refreshRes.json()
      console.log("🚀 ~ handle: ~ data:", data)
      if (!refreshRes.ok || !data.accessToken) throw new Error('Refresh failed')
      res.cookies.set('accessToken', data.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      })

      return res
    } catch (err) {
      console.error('❌ Refresh token failed:', err)
      res.cookies.delete('accessToken')
    }
    return res
  }
}
