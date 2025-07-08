'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // cần thiết nếu server set-cookie
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.message || 'Login failed')

      setMessage('✅ Login success')
      router.push('/')
      console.log('Access Token:', data.accessToken)
      console.log('User:', data.user)
    } catch (err) {
      setMessage(`❌ ${err}`)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col m-auto mt-10 gap-4 border border-gray-200 dark:border-gray-700 p-6 rounded-xl max-w-sm w-full "
    >
      <h2 className="text-lg font-semibold">Login</h2>

      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="border px-3 py-2 rounded"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="border px-3 py-2 rounded"
        required
      />

      <button
        type="submit"
        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition"
      >
        Sign In
      </button>

      {message && <p className="text-sm">{message}</p>}
    </form>
  )
}
