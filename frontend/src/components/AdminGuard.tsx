import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface Props {
  children: React.ReactNode
  /** If true, redirect to /login instead of showing inline message */
  redirect?: boolean
  /** Fallback to render for non-admins instead of the default message */
  fallback?: React.ReactNode
}

/**
 * Renders children only when the current user is an admin.
 * Non-admins see a login prompt or a custom fallback.
 */
export function AdminGuard({ children, redirect = false, fallback }: Props) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()

  if (user?.role === 'admin') return <>{children}</>

  if (redirect) {
    navigate('/login', { state: { from: location.pathname }, replace: true })
    return null
  }

  if (fallback !== undefined) return <>{fallback}</>

  return (
    <div className="p-4 rounded-xl border border-gray-700 bg-gray-900 text-center text-sm text-gray-400">
      Admin access required.{' '}
      <button
        onClick={() => navigate('/login', { state: { from: location.pathname } })}
        className="text-blue-400 hover:text-blue-300 underline"
      >
        Sign in
      </button>
    </div>
  )
}
