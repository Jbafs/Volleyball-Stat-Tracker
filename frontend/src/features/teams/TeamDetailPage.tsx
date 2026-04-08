import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Plus, Pencil, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useTeam, useUpdateTeam, useSaveTeamDefaultLineup } from '../../api/teams'
import { useTeamPlayers, useCreatePlayer, useUpdatePlayer } from '../../api/players'
import { useSeasons, usePlayerStats, useCreateSeason, useUpdateSeason } from '../../api/stats'
import { useAuthStore } from '../../store/authStore'
import { ProposeModal } from '../proposals/ProposeModal'
import { POSITION_LABELS, POSITIONS } from '@vst/shared'
import type { Position } from '@vst/shared'

const SLOT_LABELS: Record<number, string> = {
  1: 'Slot 1 — Right Back (Server)',
  2: 'Slot 2 — Right Front',
  3: 'Slot 3 — Middle Front',
  4: 'Slot 4 — Left Front',
  5: 'Slot 5 — Left Back',
  6: 'Slot 6 — Middle Back',
}

// ─── Edit Team Modal ──────────────────────────────────────────────────────────

function EditTeamModal({
  teamId,
  initial,
  onClose,
}: {
  teamId: string
  initial: { name: string; shortName: string; color: string }
  onClose: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [shortName, setShortName] = useState(initial.shortName)
  const [color, setColor] = useState(initial.color)
  const update = useUpdateTeam(teamId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await update.mutateAsync({ name, shortName, color })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-4">Edit Team</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Team Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Short Name (abbr)</label>
            <input className="input" value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={10} required />
          </div>
          <div>
            <label className="label">Color</label>
            <input
              type="color"
              className="h-10 w-full rounded cursor-pointer bg-gray-800 border border-gray-700"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
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

// ─── Add / Edit Player Modal ──────────────────────────────────────────────────

interface PlayerFormProps {
  teamId: string
  initial?: { id: string; name: string; number: string; position: Position }
  onClose: () => void
}

function PlayerModal({ teamId, initial, onClose }: PlayerFormProps) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [number, setNumber] = useState(initial?.number ?? '')
  const [position, setPosition] = useState<Position>(initial?.position ?? 'OH')

  const create = useCreatePlayer(teamId)
  const update = useUpdatePlayer(initial?.id ?? '', teamId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { name, number: number !== '' ? parseInt(number) : null, position }
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
        <h2 className="text-lg font-bold text-white mb-4">{isEdit ? 'Edit Player' : 'Add Player'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Jersey #</label>
            <input
              className="input"
              type="number"
              min={0}
              max={99}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="label">Position</label>
            <select className="input" value={position} onChange={(e) => setPosition(e.target.value as Position)}>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{POSITION_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Player'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Position badge colors ────────────────────────────────────────────────────

const POSITION_COLORS: Record<string, string> = {
  OH: 'bg-blue-900 text-blue-300',
  MB: 'bg-red-900 text-red-300',
  RS: 'bg-orange-900 text-orange-300',
  S: 'bg-purple-900 text-purple-300',
  L: 'bg-green-900 text-green-300',
  DS: 'bg-teal-900 text-teal-300',
}

// ─── Season Stats ─────────────────────────────────────────────────────────────

function SeasonModal({
  teamId,
  initial,
  onClose,
}: {
  teamId: string
  initial?: { id: string; name: string; startDate: string; endDate: string }
  onClose: () => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const create = useCreateSeason(teamId)
  const update = useUpdateSeason(initial?.id ?? '', teamId)

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
            <label className="label">Season Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Spring 2025" />
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
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Season'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PlayerStatRow({ playerId, playerName, position, seasonId }: {
  playerId: string; playerName: string; position: string; seasonId: string
}) {
  const { data: stats } = usePlayerStats(playerId, 'season', seasonId)
  return (
    <tr className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
      <td className="p-2 text-white font-medium">{playerName}</td>
      <td className="p-2 text-gray-400">{position}</td>
      <td className="p-2 text-right tabular-nums text-green-400">{stats?.attackKills ?? '—'}</td>
      <td className="p-2 text-right tabular-nums text-gray-300">
        {stats ? stats.attackEfficiency.toFixed(3) : '—'}
      </td>
      <td className="p-2 text-right tabular-nums text-blue-400">{stats?.serveAces ?? '—'}</td>
      <td className="p-2 text-right tabular-nums text-gray-300">
        {stats && stats.passTotalAttempts > 0 ? stats.passQualityAvg.toFixed(2) : '—'}
      </td>
      <td className="p-2 text-right tabular-nums text-yellow-400">{stats?.digAttempts ?? '—'}</td>
      <td className="p-2 text-right tabular-nums text-gray-300">{stats?.setAssists ?? '—'}</td>
    </tr>
  )
}

function SeasonStatsSection({ teamId, players }: {
  teamId: string; players: Record<string, unknown>[]
}) {
  const { data: seasons = [] } = useSeasons(teamId)
  const seasonRows = seasons as unknown as Record<string, unknown>[]
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [showNewSeason, setShowNewSeason] = useState(false)
  const [editingSeason, setEditingSeason] = useState<{ id: string; name: string; startDate: string; endDate: string } | null>(null)
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')

  if (seasonRows.length === 0 && !isAdmin) return null

  const latestSeason = seasonRows[seasonRows.length - 1]
  const effectiveSeasonId = selectedSeasonId || (latestSeason ? (latestSeason.id as string) : '')

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-2 text-left"
        >
          <h2 className="text-lg font-semibold text-white">Season Stats</h2>
          {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        {isAdmin && (
          <button onClick={() => setShowNewSeason(true)} className="btn-ghost gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> New Season
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-3">
          {seasonRows.length === 0 ? (
            <p className="text-sm text-gray-500">No seasons yet. Use "New Season" to create one.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                {seasonRows.length > 1 && (
                  <div className="flex gap-1 bg-gray-900 rounded-xl p-1 flex-wrap">
                    {seasonRows.map((s) => (
                      <button
                        key={s.id as string}
                        onClick={() => setSelectedSeasonId(s.id as string)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${effectiveSeasonId === s.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                        {s.name as string}
                      </button>
                    ))}
                  </div>
                )}
                {effectiveSeasonId && (
                  <>
                    <Link
                      to={`/teams/${teamId}/seasons/${effectiveSeasonId}`}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Season
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          const s = seasonRows.find((r) => r.id === effectiveSeasonId)
                          if (s) setEditingSeason({
                            id: s.id as string,
                            name: s.name as string,
                            startDate: (s.start_date as string | null) ?? '',
                            endDate: (s.end_date as string | null) ?? '',
                          })
                        }}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                    )}
                  </>
                )}
              </div>
              {effectiveSeasonId && players.length > 0 ? (
                <div className="card overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400 text-xs">
                        <th className="text-left p-2 font-normal">Player</th>
                        <th className="text-left p-2 font-normal">Pos</th>
                        <th className="text-right p-2 font-normal">K</th>
                        <th className="text-right p-2 font-normal">Eff</th>
                        <th className="text-right p-2 font-normal">Ace</th>
                        <th className="text-right p-2 font-normal">Rec Avg</th>
                        <th className="text-right p-2 font-normal">Dig</th>
                        <th className="text-right p-2 font-normal">Ast</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p) => (
                        <PlayerStatRow
                          key={p.id as string}
                          playerId={p.id as string}
                          playerName={p.name as string}
                          position={p.position as string}
                          seasonId={effectiveSeasonId}
                        />
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-600 p-2">K=Kills · Eff=Efficiency · Ace=Serve Aces · Rec Avg=Reception Quality · Dig=Dig Attempts · Ast=Set Assists</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No season data available.</p>
              )}
            </>
          )}
        </div>
      )}

      {showNewSeason && <SeasonModal teamId={teamId} onClose={() => setShowNewSeason(false)} />}
      {editingSeason && <SeasonModal teamId={teamId} initial={editingSeason} onClose={() => setEditingSeason(null)} />}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { data: team, isLoading: teamLoading } = useTeam(teamId!)
  const { data: players = [], isLoading: playersLoading } = useTeamPlayers(teamId!)
  const saveDefaultLineup = useSaveTeamDefaultLineup()

  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  const [showEditTeam, setShowEditTeam] = useState(false)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<{
    id: string; name: string; number: string; position: Position
  } | null>(null)
  const [showDefaultLineup, setShowDefaultLineup] = useState(false)
  const [proposeConfig, setProposeConfig] = useState<{
    entityId?: string; entityLabel?: string; initialPayload?: Record<string, unknown>; actionType: 'create' | 'update' | 'delete'
  } | null>(null)
  const [defaultLineup, setDefaultLineup] = useState<Record<number, string>>({})
  const [defaultRot, setDefaultRot] = useState(1)

  if (teamLoading) return <div className="p-6 text-gray-400">Loading...</div>
  if (!team) return <div className="p-6 text-gray-400">Team not found</div>

  const t = team as unknown as Record<string, unknown>
  const activePlayers = (players as unknown as Record<string, unknown>[]).filter((p) => p.is_active)

  // Load saved defaults into local state on first expand
  function handleToggleDefaultLineup() {
    if (!showDefaultLineup) {
      const raw = t.default_lineup as string | null
      if (raw) {
        const map: Record<string, string> = JSON.parse(raw)
        const numericMap: Record<number, string> = {}
        for (const [slot, pid] of Object.entries(map)) numericMap[parseInt(slot)] = pid
        setDefaultLineup(numericMap)
      }
      const savedRot = t.default_starting_rotation as number | null
      if (savedRot) setDefaultRot(savedRot)
    }
    setShowDefaultLineup((v) => !v)
  }

  function handleSaveDefaultLineup() {
    const payload: Record<string, string> = {}
    for (const [slot, pid] of Object.entries(defaultLineup)) {
      if (pid) payload[slot] = pid
    }
    saveDefaultLineup.mutate({ teamId: teamId!, defaultLineup: payload, defaultStartingRotation: defaultRot })
  }

  return (
    <div className="p-6">
      {/* Team header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ backgroundColor: t.color as string }}
        >
          {(t.short_name as string).slice(0, 2)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{t.name as string}</h1>
          <p className="text-gray-400 text-sm">{activePlayers.length} active players</p>
        </div>
        <button
          onClick={() => setShowEditTeam(true)}
          className="btn-ghost gap-2"
          title="Edit team"
        >
          <Pencil className="w-4 h-4" />
          Edit Team
        </button>
      </div>

      {/* Roster header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Roster</h2>
        {isAdmin ? (
          <button onClick={() => setShowAddPlayer(true)} className="btn-primary gap-2">
            <Plus className="w-4 h-4" /> Add Player
          </button>
        ) : (
          <button
            onClick={() => setProposeConfig({ actionType: 'create', entityLabel: 'new player' })}
            className="btn-secondary gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Propose Player
          </button>
        )}
      </div>

      {playersLoading && <p className="text-gray-400">Loading players...</p>}

      {/* Player list */}
      <div className="grid gap-2">
        {activePlayers.map((p) => (
          <div key={p.id as string} className="card p-3 flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {p.number !== null ? `${p.number}` : '—'}
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{p.name as string}</p>
            </div>
            <span className={`badge ${POSITION_COLORS[p.position as string] ?? 'bg-gray-700 text-gray-300'}`}>
              {p.position as string}
            </span>
            {isAdmin ? (
              <button
                onClick={() => setEditingPlayer({
                  id: p.id as string,
                  name: p.name as string,
                  number: p.number !== null ? String(p.number) : '',
                  position: p.position as Position,
                })}
                className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit player"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setProposeConfig({
                  actionType: 'update',
                  entityId: p.id as string,
                  entityLabel: p.name as string,
                  initialPayload: { name: p.name, number: p.number, position: p.position },
                })}
                className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"
                title="Propose edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {activePlayers.length === 0 && !playersLoading && (
          <div className="card p-6 text-center">
            <p className="text-gray-400 mb-3">No players yet.</p>
            <button onClick={() => setShowAddPlayer(true)} className="btn-primary">Add First Player</button>
          </div>
        )}
      </div>


      {/* Default Lineup */}
      <div className="mt-6">
        <button
          onClick={handleToggleDefaultLineup}
          className="flex items-center justify-between w-full text-left"
        >
          <h2 className="text-lg font-semibold text-white">Default Lineup</h2>
          {showDefaultLineup
            ? <ChevronUp className="w-5 h-5 text-gray-400" />
            : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
        {showDefaultLineup && (
          <div className="mt-3 card p-4 space-y-4">
            <p className="text-sm text-gray-400">
              This lineup pre-fills the starting lineup when creating a new set for this team.
            </p>
            <div>
              <label className="label">Starting rotation (1–6)</label>
              <input
                className="input w-32"
                type="number"
                min={1}
                max={6}
                value={defaultRot}
                onChange={(e) => setDefaultRot(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-gray-500 mt-1">Slot 1 = right back (server).</p>
            </div>
            <div className="space-y-2">
              {([1, 2, 3, 4, 5, 6] as const).map((slot) => (
                <div key={slot} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-44 shrink-0">{SLOT_LABELS[slot]}</span>
                  <select
                    className="input flex-1 text-sm py-1.5"
                    value={defaultLineup[slot] ?? ''}
                    onChange={(e) => setDefaultLineup((prev) => ({ ...prev, [slot]: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {(activePlayers as Record<string, unknown>[]).map((p) => (
                      <option key={p.id as string} value={p.id as string}>
                        {p.number !== null ? `#${p.number} ` : ''}{p.name as string} ({p.position as string})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveDefaultLineup}
              disabled={saveDefaultLineup.isPending}
              className="btn-primary"
            >
              {saveDefaultLineup.isPending ? 'Saving...' : 'Save Default Lineup'}
            </button>
          </div>
        )}
      </div>

      {/* Season Stats */}
      <SeasonStatsSection teamId={teamId!} players={activePlayers} />

      {/* Modals */}
      {showEditTeam && (
        <EditTeamModal
          teamId={teamId!}
          initial={{
            name: t.name as string,
            shortName: t.short_name as string,
            color: t.color as string,
          }}
          onClose={() => setShowEditTeam(false)}
        />
      )}

      {showAddPlayer && (
        <PlayerModal teamId={teamId!} onClose={() => setShowAddPlayer(false)} />
      )}

      {editingPlayer && (
        <PlayerModal
          teamId={teamId!}
          initial={editingPlayer}
          onClose={() => setEditingPlayer(null)}
        />
      )}

      {proposeConfig && (
        <ProposeModal
          entityType="player"
          actionType={proposeConfig.actionType}
          entityId={proposeConfig.entityId}
          entityLabel={proposeConfig.entityLabel}
          initialPayload={proposeConfig.initialPayload}
          onClose={() => setProposeConfig(null)}
        />
      )}
    </div>
  )
}
