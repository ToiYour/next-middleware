import { useEffect, useState } from 'react'

export const useCurrentUser = () => {
  const [user, setUser] = useState<{ username: string; role: string } | null>(null)

  useEffect(() => {
    const token = document.cookie
      .split('; ')
      .find((row) => row.startsWith('accessToken='))
      ?.split('=')[1]

    if (!token) return

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUser({ username: payload.username, role: payload.role })
    } catch (err) {
      console.log("🚀 ~ useEffect ~ err:", err)
      setUser(null)
    }
  }, [])

  return user
}
