import { NextRequest, NextResponse } from 'next/server'
import { IMiddleware } from './middlewares/type'
import { tokenApiMiddleware } from './middlewares/token.middlewares'
import { authApiMiddleware } from './middlewares/auth.middlewares'
import { roleMiddleware } from './middlewares/role.middlewares'

const middlewares: IMiddleware[] = [
  tokenApiMiddleware,
  authApiMiddleware,
  roleMiddleware
]

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone()
  const pathName = url.pathname
  let res = NextResponse.next()

  console.log("🔵 middleware pathName:", pathName)

  for (const middleware of middlewares) {
    if (!middleware.matcher.test(pathName)) continue
    if (middleware.excluded.test(pathName)) continue

    const midRes = await middleware.handle(req, res)
    console.log("🚀 ~ middleware ~ midRes:", midRes)
    if (midRes !== NextResponse?.next()) {
      res = midRes
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!static|.*\\..*|_next).*)',
  ]
}
