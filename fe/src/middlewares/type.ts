import { NextRequest, NextResponse } from "next/server"

export interface IMiddleware {
matcher:RegExp
excluded:RegExp
handle: (req: NextRequest, res: NextResponse) => Promise<NextResponse>
}