'use client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export default function Header() {
  const user = useCurrentUser()

  return (
    <header className="p-4 border-b">
      {user ? (
        <div>
          Welcome, <strong>{user.username}</strong> ({user.role})
        </div>
      ) : (
        <div>Not logged in</div>
      )}
    </header>
  )
}
