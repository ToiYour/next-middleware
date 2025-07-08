import { IMiddleware } from './type'
import { NextResponse } from 'next/server'

export const proxyApiMiddleware: IMiddleware = {
    matcher: /^\/api\//,
    excluded: /^\/login$/,

    handle: async (req, res) => {
        const accessToken = req.cookies.get('accessToken')?.value || res?.cookies.get('accessToken')?.value


        if (!accessToken) return res
        const pathName = req?.nextUrl?.pathname?.replace(/\/api\//, "")
        const headers = new Headers(req?.headers)
        headers?.set('authorization', `Bearer ${accessToken}`)
        const baseApiUrl = process?.env?.API_URL ?? ''
        const target = new URL(baseApiUrl)
        target.pathname = `${target?.password}${pathName}`
        return NextResponse?.rewrite(target, { headers })
    }
}
