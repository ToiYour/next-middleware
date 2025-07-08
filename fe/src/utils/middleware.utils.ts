export class MiddlewareUtils {
  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp < now
    } catch {
      return true
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static parseToken(token: string): any {
    try {
      return JSON.parse(atob(token.split('.')[1]))
    } catch {
      return null
    }
  }

  static logMiddleware(name: string, path: string, action: string) {
    console.log(`🔄 [${name}] ${action} for path: ${path}`)
  }
}