import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useTeams, useCreateTeam } from '../../api/teams'

function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const create = useCreateTeam()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !shortName) return
    await create.mutateAsync({ name, shortName, color })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-4">Create Team</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Team Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Valley Lions" required />
          </div>
          <div>
            <label className="label">Short Name (abbr)</label>
            <input className="input" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. VL" maxLength={10} required />
          </div>
          <div>
            <label className="label">Color</label>
            <input type="color" className="h-10 w-full rounded cursor-pointer bg-gray-800 border border-gray-700" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
              {create.isPending ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function TeamsPage() {
  const { data: teams = [], isLoading } = useTeams()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Teams</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
          <Plus className="w-4 h-4" /> New Team
        </button>
      </div>

      {isLoading && <p className="text-gray-400">Loading...</p>}

      <div className="grid gap-3">
        {(teams as unknown as Record<string, unknown>[]).map((team) => (
          <Link
            key={team.id as string}
            to={`/teams/${team.id}`}
            className="card p-4 flex items-center gap-4 hover:border-blue-700 transition-colors"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: team.color as string }}
            >
              {(team.short_name as string).slice(0, 2)}
            </div>
            <div>
              <p className="font-semibold text-white">{team.name as string}</p>
              <p className="text-sm text-gray-400">{team.short_name as string}</p>
            </div>
          </Link>
        ))}

        {teams.length === 0 && !isLoading && (
          <div className="card p-8 text-center">
            <p className="text-gray-400 mb-4">No teams yet. Create your first team to get started.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create Team</button>
          </div>
        )}
      </div>

      {showCreate && <CreateTeamModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
