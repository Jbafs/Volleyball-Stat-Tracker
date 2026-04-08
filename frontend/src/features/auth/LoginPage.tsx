import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { useLogin } from '../../api/auth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await login.mutateAsync({ email, password })
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <ClipboardList className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-white text-lg">VB Stats — Admin Login</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={login.isPending}
            className="btn-primary w-full"
          >
            {login.isPending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-4 text-center">
          Read-only access is available without logging in.
        </p>
      </div>
    </div>
  )
}
