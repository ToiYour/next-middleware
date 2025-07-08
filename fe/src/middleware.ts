import { NextRequest, NextResponse } from 'next/server'
import { IMiddleware, MiddlewareContext } from './middlewares/type'
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

  // Tạo context để share data giữa các middleware
  const context: MiddlewareContext = {}

  for (const middleware of middlewares) {
    if (!middleware.matcher.test(pathName)) continue
    if (middleware.excluded.test(pathName)) continue

    console.log(`🔄 Running middleware: ${middleware.constructor.name}`)
    
    const midRes = await middleware.handle(req, res, context)
    
    if (midRes !== NextResponse?.next()) {
      res = midRes
      // Nếu middleware trả về redirect, dừng chain
      if (midRes.status === 307 || midRes.status === 308 || midRes.headers.get('location')) {
        break
      }
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!static|.*\\..*|_next).*)',
  ]
}