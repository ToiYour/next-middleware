/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"

export interface IMiddleware {
matcher:RegExp
excluded:RegExp
handle: (req: NextRequest, res: NextResponse, context?: MiddlewareContext) => Promise<NextResponse>
}
export interface MiddlewareContext {
  accessToken?: string | null
  refreshToken?: string | null
  user?: any
  [key: string]: any
}