import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useAdminUsers, useCreateAdminUser, useDeleteAdminUser } from '../../api/auth'

export function UsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const { data: users = [], isLoading } = useAdminUsers()
  const createUser = useCreateAdminUser()
  const deleteUser = useDeleteAdminUser()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createUser.mutateAsync({ email, password })
    setEmail('')
    setPassword('')
    setShowForm(false)
  }

  async function handleDelete(userId: string, userEmail: string) {
    if (!window.confirm(`Delete admin account for ${userEmail}? This cannot be undone.`)) return
    await deleteUser.mutateAsync(userId)
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Admin Users</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            Add Admin
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 space-y-4">
          <h2 className="text-base font-semibold text-white">New Admin Account</h2>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Password (min 8 characters)</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => { setShowForm(false); setEmail(''); setPassword('') }} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={createUser.isPending} className="btn-primary flex-1">
              {createUser.isPending ? 'Creating...' : 'Create Admin'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-gray-400">Loading...</p>}

      <div className="space-y-2">
        {(users as unknown as { id: string; email: string; role: string; created_at: number }[]).map((u) => {
          const isSelf = u.id === currentUser?.id
          return (
            <div key={u.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">
                  {u.email}
                  {isSelf && <span className="ml-2 text-xs text-blue-400">(you)</span>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Added {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(u.id, u.email)}
                disabled={isSelf || deleteUser.isPending}
                className="btn-ghost text-xs px-3 py-1.5 border border-gray-700 rounded-lg text-red-400 hover:text-red-300 hover:border-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
