import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useMatches, useCreateMatch } from '../../api/matches'
import { useTeams } from '../../api/teams'
import { useSeasons } from '../../api/stats'
import type { CreateMatchPayload } from '@vst/shared'

function CreateMatchModal({ onClose }: { onClose: () => void }) {
  const { data: teams = [] } = useTeams()
  const create = useCreateMatch()

  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [opponentName, setOpponentName] = useState('')
  const [matchDate, setMatchDate] = useState(new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [awayIsTracked, setAwayIsTracked] = useState(false)
  const [format, setFormat] = useState<'bo3' | 'bo5'>('bo3')
  const [seasonId, setSeasonId] = useState('')

  const { data: seasons = [] } = useSeasons(homeTeamId)
  const seasonRows = seasons as unknown as Record<string, unknown>[]

  function handleHomeTeamChange(id: string) {
    setHomeTeamId(id)
    setSeasonId('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: CreateMatchPayload = {
      homeTeamId: homeTeamId || null,
      awayTeamId: awayIsTracked ? (awayTeamId || null) : null,
      opponentName: awayIsTracked ? null : (opponentName || null),
      matchDate,
      location: location || null,
      format,
      seasonId: seasonId || null,
    }
    await create.mutateAsync(payload)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-4">New Match</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Home Team (tracked)</label>
            <select className="input" value={homeTeamId} onChange={(e) => handleHomeTeamChange(e.target.value)} required>
              <option value="">Select team...</option>
              {(teams as unknown as Record<string, unknown>[]).map((t) => (
                <option key={t.id as string} value={t.id as string}>{t.name as string}</option>
              ))}
            </select>
          </div>

          {homeTeamId && seasonRows.length > 0 && (
            <div>
              <label className="label">Season (optional)</label>
              <select className="input" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
                <option value="">No season</option>
                {seasonRows.map((s) => (
                  <option key={s.id as string} value={s.id as string}>{s.name as string}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Opponent</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setAwayIsTracked(false)}
                className={`flex-1 py-1.5 rounded text-sm border ${!awayIsTracked ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'}`}
              >
                Untracked (name only)
              </button>
              <button
                type="button"
                onClick={() => setAwayIsTracked(true)}
                className={`flex-1 py-1.5 rounded text-sm border ${awayIsTracked ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'}`}
              >
                Tracked Team
              </button>
            </div>
            {awayIsTracked ? (
              <select className="input" value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)}>
                <option value="">Select away team...</option>
                {(teams as unknown as Record<string, unknown>[]).filter((t) => t.id !== homeTeamId).map((t) => (
                  <option key={t.id as string} value={t.id as string}>{t.name as string}</option>
                ))}
              </select>
            ) : (
              <input className="input" value={opponentName} onChange={(e) => setOpponentName(e.target.value)} placeholder="e.g. Central High" />
            )}
          </div>

          <div>
            <label className="label">Format</label>
            <div className="flex gap-2">
              {([['bo3', 'Best of 3'], ['bo5', 'Best of 5']] as const).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFormat(v)}
                  className={`flex-1 py-1.5 rounded text-sm border ${format === v ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
          </div>

          <div>
            <label className="label">Location (optional)</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Home Gym" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary flex-1">
              {create.isPending ? 'Creating...' : 'Create Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-700 text-gray-300',
  in_progress: 'bg-green-900 text-green-300',
  complete: 'bg-blue-900 text-blue-300',
}

const PAGE_SIZE = 20

export function MatchesPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [page, setPage] = useState(0)

  const { data: matches = [], isLoading } = useMatches({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })
  const { data: nextPage = [] } = useMatches({ limit: 1, offset: (page + 1) * PAGE_SIZE })
  const hasMore = nextPage.length > 0

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Matches</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
          <Plus className="w-4 h-4" /> New Match
        </button>
      </div>

      {isLoading && <p className="text-gray-400">Loading...</p>}

      <div className="space-y-3">
        {(matches as unknown as Record<string, unknown>[]).map((m) => (
          <Link
            key={m.id as string}
            to={`/matches/${m.id}`}
            className="card p-4 flex items-center justify-between hover:border-blue-700 transition-colors block"
          >
            <div>
              <p className="font-semibold text-white">
                {(m.home_team_name as string | undefined) ?? 'TBD'} vs {(m.away_team_name as string | undefined) ?? (m.opponent_name as string | undefined) ?? 'TBD'}
              </p>
              <p className="text-sm text-gray-400">
                {m.match_date as string}
                {(m.location as string | null) && ` · ${m.location as string}`}
              </p>
            </div>
            <span className={`badge ${STATUS_COLORS[m.status as string] ?? ''}`}>
              {(m.status as string).replace('_', ' ')}
            </span>
          </Link>
        ))}

        {matches.length === 0 && !isLoading && (
          <div className="card p-8 text-center">
            <p className="text-gray-400 mb-4">No matches yet.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">Create First Match</button>
          </div>
        )}
      </div>

      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary px-4 py-2 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-400">Page {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="btn-secondary px-4 py-2 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {showCreate && <CreateMatchModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
