import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useMatch, useMatchSets, useCreateSet, useUpdateMatchStatus, useUpdateMatch, useDeleteMatch } from '../../api/matches'
import { useTeamPlayers } from '../../api/players'
import { useTeam, useSaveTeamDefaultLineup } from '../../api/teams'
import { useSeasons } from '../../api/stats'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import { ProposeModal } from '../proposals/ProposeModal'
import type { CreateSetPayload } from '@vst/shared'

const SLOT_LABELS: Record<number, string> = {
  1: 'Slot 1 — Right Back (Server)',
  2: 'Slot 2 — Right Front',
  3: 'Slot 3 — Middle Front',
  4: 'Slot 4 — Left Front',
  5: 'Slot 5 — Left Back',
  6: 'Slot 6 — Middle Back',
}

function LineupEditor({
  players,
  lineup,
  onChange,
}: {
  players: Array<{ id: string; name: string; number: number | null; position: string }>
  lineup: Record<number, string>
  onChange: (slot: number, playerId: string) => void
}) {
  return (
    <div className="space-y-2">
      {([1, 2, 3, 4, 5, 6] as const).map((slot) => (
        <div key={slot} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-44 shrink-0">{SLOT_LABELS[slot]}</span>
          <select
            className="input flex-1 text-sm py-1.5"
            value={lineup[slot] ?? ''}
            onChange={(e) => onChange(slot, e.target.value)}
          >
            <option value="">— None —</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number !== null ? `#${p.number} ` : ''}{p.name} ({p.position})
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

function CreateSetModal({
  matchId,
  nextSetNumber,
  homeTeamId,
  awayTeamId,
  onClose,
}: {
  matchId: string
  nextSetNumber: number
  homeTeamId: string | null
  awayTeamId: string | null
  onClose: () => void
}) {
  const create = useCreateSet(matchId)
  const saveDefaultLineup = useSaveTeamDefaultLineup()
  const [homeRot, setHomeRot] = useState(1)
  const [awayRot, setAwayRot] = useState(1)
  const [servingTeam, setServingTeam] = useState<'home' | 'away'>('home')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Lineup state: slot → playerId (empty string = none)
  const [homeLineup, setHomeLineup] = useState<Record<number, string>>({})
  const [awayLineup, setAwayLineup] = useState<Record<number, string>>({})

  const { data: homePlayers = [] } = useTeamPlayers(homeTeamId ?? '')
  const { data: awayPlayers = [] } = useTeamPlayers(awayTeamId ?? '')
  const { data: homeTeam } = useTeam(homeTeamId ?? '')
  const { data: awayTeam } = useTeam(awayTeamId ?? '')

  // Pre-populate lineup from saved defaults (only on first load)
  const homeDefaultLoaded = useRef(false)
  const awayDefaultLoaded = useRef(false)

  useEffect(() => {
    if (homeDefaultLoaded.current || !homeTeam) return
    homeDefaultLoaded.current = true
    const raw = (homeTeam as unknown as Record<string, unknown>).default_lineup as string | null
    if (!raw) return
    const map: Record<string, string> = JSON.parse(raw)
    const numericMap: Record<number, string> = {}
    for (const [slot, pid] of Object.entries(map)) numericMap[parseInt(slot)] = pid
    setHomeLineup(numericMap)
    const defaultRot = (homeTeam as unknown as Record<string, unknown>).default_starting_rotation as number | null
    if (defaultRot) setHomeRot(defaultRot)
  }, [homeTeam])

  useEffect(() => {
    if (awayDefaultLoaded.current || !awayTeam) return
    awayDefaultLoaded.current = true
    const raw = (awayTeam as unknown as Record<string, unknown>).default_lineup as string | null
    if (!raw) return
    const map: Record<string, string> = JSON.parse(raw)
    const numericMap: Record<number, string> = {}
    for (const [slot, pid] of Object.entries(map)) numericMap[parseInt(slot)] = pid
    setAwayLineup(numericMap)
    const defaultRot = (awayTeam as unknown as Record<string, unknown>).default_starting_rotation as number | null
    if (defaultRot) setAwayRot(defaultRot)
  }, [awayTeam])

  function updateHomeSlot(slot: number, playerId: string) {
    setHomeLineup((prev) => ({ ...prev, [slot]: playerId }))
  }

  function updateAwaySlot(slot: number, playerId: string) {
    setAwayLineup((prev) => ({ ...prev, [slot]: playerId }))
  }

  function buildDefaultLineupPayload(lineup: Record<number, string>): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [slot, pid] of Object.entries(lineup)) {
      if (pid) result[slot] = pid
    }
    return result
  }

  async function handleCreate() {
    setIsSubmitting(true)
    try {
      const payload: CreateSetPayload = {
        setNumber: nextSetNumber,
        homeStartingRotation: homeRot,
        awayStartingRotation: awayRot,
        firstServingTeamId: servingTeam === 'home' ? homeTeamId : awayTeamId,
      }
      const newSet = await create.mutateAsync(payload)
      const setId = (newSet as unknown as Record<string, unknown>).id as string

      // Submit lineups for tracked teams
      const homeSlots = Object.entries(homeLineup)
        .filter(([, pid]) => pid)
        .map(([slot, pid]) => ({ rotationSlot: parseInt(slot), playerId: pid }))
      if (homeTeamId && homeSlots.length > 0) {
        await api.post(`/sets/${setId}/lineup`, { teamId: homeTeamId, slots: homeSlots })
      }

      const awaySlots = Object.entries(awayLineup)
        .filter(([, pid]) => pid)
        .map(([slot, pid]) => ({ rotationSlot: parseInt(slot), playerId: pid }))
      if (awayTeamId && awaySlots.length > 0) {
        await api.post(`/sets/${setId}/lineup`, { teamId: awayTeamId, slots: awaySlots })
      }

      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white mb-4">Start Set {nextSetNumber}</h2>
        <div className="space-y-5">
          {/* Rotation + serving team */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Home starting rotation (1–6)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={6}
                value={homeRot}
                onChange={(e) => setHomeRot(parseInt(e.target.value))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Slot 1 = right back (server). Rotation = which slot is currently at slot 1.
              </p>
            </div>
            <div>
              <label className="label">Away starting rotation (1–6)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={6}
                value={awayRot}
                onChange={(e) => setAwayRot(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="label">Who serves first?</label>
            <div className="flex gap-2">
              {(['home', 'away'] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setServingTeam(side)}
                  className={`flex-1 py-2 rounded text-sm border ${
                    servingTeam === side
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300'
                  }`}
                >
                  {side === 'home' ? 'Home' : 'Away'}
                </button>
              ))}
            </div>
          </div>

          {/* Home lineup */}
          {homeTeamId && homePlayers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label">Home Team Lineup (optional)</p>
                <button
                  type="button"
                  onClick={() => saveDefaultLineup.mutate({
                    teamId: homeTeamId,
                    defaultLineup: buildDefaultLineupPayload(homeLineup),
                    defaultStartingRotation: homeRot,
                  })}
                  disabled={saveDefaultLineup.isPending}
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  {saveDefaultLineup.isPending ? 'Saving...' : 'Save as default'}
                </button>
              </div>
              <LineupEditor
                players={homePlayers as Array<{ id: string; name: string; number: number | null; position: string }>}
                lineup={homeLineup}
                onChange={updateHomeSlot}
              />
            </div>
          )}

          {/* Away lineup */}
          {awayTeamId && awayPlayers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label">Away Team Lineup (optional)</p>
                <button
                  type="button"
                  onClick={() => saveDefaultLineup.mutate({
                    teamId: awayTeamId,
                    defaultLineup: buildDefaultLineupPayload(awayLineup),
                    defaultStartingRotation: awayRot,
                  })}
                  disabled={saveDefaultLineup.isPending}
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  {saveDefaultLineup.isPending ? 'Saving...' : 'Save as default'}
                </button>
              </div>
              <LineupEditor
                players={awayPlayers as Array<{ id: string; name: string; number: number | null; position: string }>}
                lineup={awayLineup}
                onChange={updateAwaySlot}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleCreate} disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Starting...' : 'Start Set'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditMatchModal({
  matchId,
  initialDate,
  initialLocation,
  initialNotes,
  initialFormat,
  initialSeasonId,
  homeTeamId,
  onClose,
}: {
  matchId: string
  initialDate: string
  initialLocation: string
  initialNotes: string
  initialFormat: 'bo3' | 'bo5'
  initialSeasonId: string
  homeTeamId: string | null
  onClose: () => void
}) {
  const [matchDate, setMatchDate] = useState(initialDate)
  const [location, setLocation] = useState(initialLocation)
  const [notes, setNotes] = useState(initialNotes)
  const [format, setFormat] = useState<'bo3' | 'bo5'>(initialFormat)
  const [seasonId, setSeasonId] = useState(initialSeasonId)
  const update = useUpdateMatch()
  const { data: seasons = [] } = useSeasons(homeTeamId ?? '')
  const seasonRows = seasons as unknown as Record<string, unknown>[]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await update.mutateAsync({
      matchId,
      matchDate,
      location: location || null,
      notes: notes || null,
      format,
      seasonId: seasonId || null,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-white mb-4">Edit Match</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} required />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Home Gym" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
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
          {seasonRows.length > 0 && (
            <div>
              <label className="label">Season</label>
              <select className="input" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}>
                <option value="">No season</option>
                {seasonRows.map((s) => (
                  <option key={s.id as string} value={s.id as string}>{s.name as string}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={update.isPending} className="btn-primary flex-1">
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const { data: match, isLoading } = useMatch(matchId!)
  const { data: sets = [] } = useMatchSets(matchId!)
  const updateStatus = useUpdateMatchStatus()
  const updateMatch = useUpdateMatch()
  const deleteMatch = useDeleteMatch()
  const [showCreateSet, setShowCreateSet] = useState(false)
  const [showEditMatch, setShowEditMatch] = useState(false)
  const [showPropose, setShowPropose] = useState(false)
  const [showProposeEdit, setShowProposeEdit] = useState(false)
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')

  async function handleDelete() {
    if (!confirm('Delete this match and all its sets and rallies? This cannot be undone.')) return
    await deleteMatch.mutateAsync(matchId!)
    navigate('/matches')
  }

  if (isLoading) return <div className="p-6 text-gray-400">Loading...</div>
  if (!match) return <div className="p-6 text-gray-400">Match not found</div>

  const m = match as unknown as Record<string, unknown>
  const setList = sets as unknown as Record<string, unknown>[]

  const nextSetNumber = setList.length + 1

  // Compute set wins from completed sets
  const completedSets = setList.filter((s) => s.status === 'complete')
  const homeSetsWon = completedSets.filter((s) => (s.home_score as number) > (s.away_score as number)).length
  const awaySetsWon = completedSets.filter((s) => (s.away_score as number) > (s.home_score as number)).length
  const winThreshold = (m.format as string) === 'bo5' ? 3 : 2
  const canFinishMatch = m.status === 'in_progress' && (homeSetsWon >= winThreshold || awaySetsWon >= winThreshold)
  const matchIsComplete = m.status === 'complete'

  async function handleStartMatch() {
    await updateStatus.mutateAsync({ matchId: matchId!, status: 'in_progress' })
  }

  async function handleFinishMatch() {
    if (!confirm('Mark this match as complete? No more sets can be added.')) return
    await updateStatus.mutateAsync({ matchId: matchId!, status: 'complete' })
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {(m.home_team_name as string) ?? 'TBD'} vs {(m.away_team_name as string) ?? (m.opponent_name as string) ?? 'TBD'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {m.match_date as string}
            {(m.location as string | null) && ` · ${m.location as string}`}
          </p>
          {m.status !== 'complete' ? (
            <div className="flex gap-1 mt-2">
              {(['bo3', 'bo5'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => updateMatch.mutate({ matchId: matchId!, format: f })}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${
                    (m.format as string) === f
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {f === 'bo3' ? 'Best of 3' : 'Best of 5'}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-xs mt-1">{(m.format as string) === 'bo5' ? 'Best of 5' : 'Best of 3'}</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {isAdmin && (
            <button
              onClick={() => setShowEditMatch(true)}
              className="btn-ghost gap-2"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={deleteMatch.isPending}
              className="btn-secondary gap-2 text-red-400 hover:text-red-300 hover:border-red-700"
            >
              <Trash2 className="w-4 h-4" />
              {deleteMatch.isPending ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {m.status === 'planned' && (
        <button onClick={handleStartMatch} className="btn-primary mb-6">
          Start Match
        </button>
      )}

      {canFinishMatch && (
        <div className="mb-6 p-4 rounded-xl border border-green-800/60 bg-green-900/20 flex items-center justify-between">
          <div>
            <p className="text-green-400 font-semibold">
              {homeSetsWon >= winThreshold
                ? `${(m.home_team_name as string) ?? 'Home'} wins`
                : `${(m.away_team_name as string) ?? (m.opponent_name as string) ?? 'Away'} wins`}
            </p>
            <p className="text-gray-400 text-sm">{homeSetsWon}–{awaySetsWon} sets</p>
          </div>
          <button onClick={handleFinishMatch} disabled={updateStatus.isPending} className="btn-primary bg-green-600 border-green-500 hover:bg-green-500">
            {updateStatus.isPending ? 'Saving...' : 'Finish Match'}
          </button>
        </div>
      )}

      {matchIsComplete && (
        <div className="mb-6 p-4 rounded-xl border border-green-800/40 bg-green-900/10 flex items-center justify-between">
          <div>
            <p className="text-green-400 font-semibold">Match Complete</p>
            <p className="text-gray-400 text-sm">{homeSetsWon}–{awaySetsWon} sets</p>
          </div>
          <Link to={`/matches/${matchId}/recap`} className="btn-secondary text-sm">
            View Recap →
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Sets</h2>
        {m.status === 'in_progress' && (
          <button onClick={() => setShowCreateSet(true)} className="btn-secondary gap-2">
            <Plus className="w-4 h-4" /> Add Set
          </button>
        )}
      </div>

      <div className="space-y-3">
        {setList.map((s) => {
          const isComplete = s.status === 'complete'
          return (
            <div key={s.id as string} className={`card p-4 flex items-center justify-between ${isComplete ? 'border-green-900/50' : ''}`}>
              <div>
                <p className="font-semibold text-white flex items-center gap-2">
                  Set {s.set_number as number}
                  <span className="text-xl tabular-nums">
                    {s.home_score as number} – {s.away_score as number}
                  </span>
                  {isComplete && (
                    <span className="text-xs font-normal text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">Final</span>
                  )}
                </p>
                <p className="text-sm text-gray-400">
                  {!isComplete && (s.status as string)}
                  {!!(s.home_starting_rotation) && ` · Home R${s.home_starting_rotation as number} / Away R${s.away_starting_rotation as number}`}
                </p>
              </div>
              {isAdmin ? (
                <Link
                  to={`/matches/${matchId}/enter/${s.id}`}
                  className="btn-primary gap-2"
                >
                  <Play className="w-4 h-4" /> Enter Stats
                </Link>
              ) : (
                <span className="text-xs text-gray-500 italic">Admin only</span>
              )}
            </div>
          )
        })}

        {setList.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-gray-400 mb-3">No sets yet. {m.status === 'planned' ? 'Start the match first.' : 'Add the first set.'}</p>

            {m.status === 'in_progress' && (
              <button onClick={() => setShowCreateSet(true)} className="btn-primary">Add Set 1</button>
            )}
          </div>
        )}
      </div>

      {/* Corrections / suggestions */}
      <div className="mt-6 pt-4 border-t border-gray-800 flex flex-wrap gap-4">
        {!isAdmin && (
          <button
            onClick={() => setShowProposeEdit(true)}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Suggest match details edit →
          </button>
        )}
        <button
          onClick={() => setShowPropose(true)}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Report a score correction or suggestion →
        </button>
      </div>

      {showCreateSet && (
        <CreateSetModal
          matchId={matchId!}
          nextSetNumber={nextSetNumber}
          homeTeamId={m.home_team_id as string | null}
          awayTeamId={m.away_team_id as string | null}
          onClose={() => setShowCreateSet(false)}
        />
      )}

      {showEditMatch && (
        <EditMatchModal
          matchId={matchId!}
          initialDate={m.match_date as string}
          initialLocation={(m.location as string | null) ?? ''}
          initialNotes={(m.notes as string | null) ?? ''}
          initialFormat={(m.format as 'bo3' | 'bo5') ?? 'bo3'}
          initialSeasonId={(m.season_id as string | null) ?? ''}
          homeTeamId={m.home_team_id as string | null}
          onClose={() => setShowEditMatch(false)}
        />
      )}

      {showPropose && (
        <ProposeModal
          entityType="score_correction"
          actionType="correct"
          entityId={matchId}
          entityLabel={`match on ${m.match_date as string}`}
          onClose={() => setShowPropose(false)}
        />
      )}

      {showProposeEdit && (
        <ProposeModal
          entityType="match"
          actionType="update"
          entityId={matchId}
          entityLabel={`match on ${m.match_date as string}`}
          initialPayload={{
            matchDate: m.match_date as string,
            location: (m.location as string | null) ?? '',
            notes: (m.notes as string | null) ?? '',
            format: m.format as string,
          }}
          onClose={() => setShowProposeEdit(false)}
        />
      )}
    </div>
  )
}
