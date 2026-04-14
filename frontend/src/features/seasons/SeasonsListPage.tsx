import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAllSeasons, useCreateSeason, useUpdateSeason, useDeleteSeason } from '../../api/stats'
import { useAuthStore } from '../../store/authStore'

function SeasonFormModal({
  initial,
  onClose,
}: {
  initial?: { id: string; name: string; startDate: string; endDate: string }
  onClose: () => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const create = useCreateSeason()
  const update = useUpdateSeason(initial?.id ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { name, startDate: startDate || null, endDate: endDate || null }
    if (isEdit) {
      await update.mutateAsync(payload)
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  const isPending = create.isPending || update.isPending

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold text-white mb-4">{isEdit ? 'Edit Season' : 'New Season'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Spring 2025" autoFocus />
          </div>
          <div>
            <label className="label">Start Date (optional)</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">End Date (optional)</label>
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Saving...' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SeasonsListPage() {
  const { data: allSeasons = [], isLoading } = useAllSeasons()
  const seasonRows = allSeasons as unknown as Record<string, unknown>[]
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string; startDate: string; endDate: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deleteSeason = useDeleteSeason(deletingId ?? '')

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete season "${name}"? Matches will lose their season assignment.`)) return
    setDeletingId(id)
    await deleteSeason.mutateAsync()
    setDeletingId(null)
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Seasons</h1>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
            <Plus className="w-4 h-4" /> New Season
          </button>
        )}
      </div>

      {isLoading && <p className="text-gray-400">Loading…</p>}

      {seasonRows.length === 0 && !isLoading && (
        <div className="card p-8 text-center">
          <p className="text-gray-400 mb-4">No seasons yet.</p>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create First Season</button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {seasonRows.map((s) => {
          const id = s.id as string
          const name = s.name as string
          const startDate = s.start_date as string | null
          const endDate = s.end_date as string | null
          const matchCount = (s.match_count as number) ?? 0

          return (
            <div key={id} className="card p-4 flex items-center justify-between">
              <div>
                <Link
                  to={`/seasons/${id}`}
                  className="font-semibold text-white hover:text-blue-400 transition-colors"
                >
                  {name}
                </Link>
                {(startDate || endDate) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {startDate ?? '?'} – {endDate ?? 'present'}
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-0.5">{matchCount} match{matchCount !== 1 ? 'es' : ''}</p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditing({
                      id,
                      name,
                      startDate: startDate ?? '',
                      endDate: endDate ?? '',
                    })}
                    className="btn-ghost p-1.5"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(id, name)}
                    disabled={deletingId === id}
                    className="btn-ghost p-1.5"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showCreate && <SeasonFormModal onClose={() => setShowCreate(false)} />}
      {editing && <SeasonFormModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
