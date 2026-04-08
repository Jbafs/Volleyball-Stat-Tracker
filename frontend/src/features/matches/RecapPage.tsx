import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useMatch, useMatchSets } from '../../api/matches'
import { useMatchPlayerStats, useSetPlayerStats, useRotationStats } from '../../api/stats'
import { useSetRallies, useDeleteRally } from '../../api/rallies'
import { useAuthStore } from '../../store/authStore'
import { downloadCsvRows } from '../../utils/csv'
import type { PlayerStats } from '@vst/shared'

const ROTATION_SLOT_LABELS: Record<number, string> = {
  1: 'Slot 1 — Right Back (Server)',
  2: 'Slot 2 — Right Front',
  3: 'Slot 3 — Middle Front',
  4: 'Slot 4 — Left Front',
  5: 'Slot 5 — Left Back',
  6: 'Slot 6 — Middle Back',
}

function leader(players: PlayerStats[], key: keyof PlayerStats): PlayerStats | null {
  if (!players.length) return null
  const best = players.reduce((a, b) => ((a[key] as number) >= (b[key] as number) ? a : b))
  return (best[key] as number) > 0 ? best : null
}

export function RecapPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const { data: match, isLoading } = useMatch(matchId!)
  const { data: sets = [] } = useMatchSets(matchId!)
  const { data: matchPlayerStats = [] } = useMatchPlayerStats(matchId!)
  const [statsSetId, setStatsSetId] = useState('')
  const { data: setPlayerStats = [] } = useSetPlayerStats(statsSetId)
  const [rotationSetId, setRotationSetId] = useState('')
  const [rotationTeamSide, setRotationTeamSide] = useState<'home' | 'away'>('home')

  if (isLoading) return <div className="p-6 text-gray-400">Loading...</div>
  if (!match) return <div className="p-6 text-gray-400">Match not found</div>

  const m = match as unknown as Record<string, unknown>
  const setList = sets as unknown as Record<string, unknown>[]

  const homeTeamName = (m.home_team_name as string | null) ?? 'Home'
  const awayTeamName = (m.away_team_name as string | null) ?? (m.opponent_name as string | null) ?? 'Away'
  const homeTeamId = (m.home_team_id as string | null) ?? ''
  const awayTeamId = (m.away_team_id as string | null) ?? ''

  // Rotation breakdown: default to first completed set if none selected
  const completedSetIds = setList.filter((s) => s.status === 'complete').map((s) => s.id as string)
  const activeRotationSetId = rotationSetId || completedSetIds[0] || ''
  // If away team is untracked (no ID), always fall back to home
  const effectiveRotationSide = (!awayTeamId && rotationTeamSide === 'away') ? 'home' : rotationTeamSide
  const rotationTeamId = effectiveRotationSide === 'home' ? homeTeamId : awayTeamId
  const { data: rotationData = [] } = useRotationStats(activeRotationSetId, rotationTeamId)

  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  const [rallyLogOpen, setRallyLogOpen] = useState(false)
  const rallyLogSetId = statsSetId || completedSetIds[0] || ''
  const { data: rallyLogRallies = [] } = useSetRallies(rallyLogSetId)
  const deleteRally = useDeleteRally(rallyLogSetId)

  const completedSets = setList.filter((s) => s.status === 'complete')
  const homeSetsWon = completedSets.filter((s) => (s.home_score as number) > (s.away_score as number)).length
  const awaySetsWon = completedSets.filter((s) => (s.away_score as number) > (s.home_score as number)).length

  const playerStats = statsSetId ? setPlayerStats : matchPlayerStats

  const killLeader = leader(playerStats, 'attackKills')
  const aceLeader = leader(playerStats, 'serveAces')
  const blockLeader = leader(playerStats, 'soloBlocks')
  const digLeader = leader(playerStats, 'digAttempts')

  const statsSorted = [...playerStats].sort((a, b) => b.attackKills - a.attackKills)

  function handleExport() {
    downloadCsvRows(
      `recap-${matchId}.csv`,
      ['Player', 'Position', 'Kills', 'Attack Errors', 'Attack Attempts', 'Eff', 'Aces', 'Serve Errors', 'Solo Blocks', 'Assisted Blocks', 'Digs', 'Assists'],
      statsSorted.map((p) => [
        p.playerName, p.position,
        p.attackKills, p.attackErrors, p.attackAttempts, p.attackEfficiency.toFixed(3),
        p.serveAces, p.serveErrors,
        p.soloBlocks, p.assistedBlocks,
        p.digAttempts, p.setAssists,
      ])
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/matches/${matchId}`} className="btn-ghost gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Match Recap</h1>
          <p className="text-gray-400 text-sm">{m.match_date as string}{(m.location as string | null) && ` · ${m.location as string}`}</p>
        </div>
      </div>

      {/* Final score */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-300 mb-4">Final Score</h2>
        <div className="flex items-center gap-6 mb-4">
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-white">{homeTeamName}</p>
            <p className="text-4xl font-bold tabular-nums text-white mt-1">{homeSetsWon}</p>
          </div>
          <p className="text-2xl text-gray-600">–</p>
          <div className="text-center flex-1">
            <p className="text-lg font-bold text-white">{awayTeamName}</p>
            <p className="text-4xl font-bold tabular-nums text-white mt-1">{awaySetsWon}</p>
          </div>
        </div>
        {setList.length > 0 && (
          <div className="border-t border-gray-800 pt-3">
            <table className="w-full text-sm text-center">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left py-1 font-normal">Set</th>
                  <th className="py-1 font-normal">{homeTeamName}</th>
                  <th className="py-1 font-normal">{awayTeamName}</th>
                </tr>
              </thead>
              <tbody>
                {setList.map((s) => {
                  const homeWon = (s.home_score as number) > (s.away_score as number)
                  return (
                    <tr key={s.id as string} className="border-t border-gray-800">
                      <td className="text-left py-1.5 text-gray-400">Set {s.set_number as number}</td>
                      <td className={`py-1.5 tabular-nums font-medium ${homeWon ? 'text-green-400' : 'text-gray-300'}`}>
                        {s.home_score as number}
                      </td>
                      <td className={`py-1.5 tabular-nums font-medium ${!homeWon ? 'text-green-400' : 'text-gray-300'}`}>
                        {s.away_score as number}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top performers */}
      {(killLeader || aceLeader || blockLeader || digLeader) && (
        <div>
          <h2 className="text-base font-semibold text-gray-300 mb-3">Top Performers</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {killLeader && (
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-green-400 tabular-nums">{killLeader.attackKills}</p>
                <p className="text-sm text-white font-medium mt-1 truncate">{killLeader.playerName}</p>
                <p className="text-xs text-gray-500">Kills</p>
              </div>
            )}
            {aceLeader && (
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-blue-400 tabular-nums">{aceLeader.serveAces}</p>
                <p className="text-sm text-white font-medium mt-1 truncate">{aceLeader.playerName}</p>
                <p className="text-xs text-gray-500">Aces</p>
              </div>
            )}
            {blockLeader && (
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-purple-400 tabular-nums">{blockLeader.soloBlocks}</p>
                <p className="text-sm text-white font-medium mt-1 truncate">{blockLeader.playerName}</p>
                <p className="text-xs text-gray-500">Solo Blocks</p>
              </div>
            )}
            {digLeader && (
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-yellow-400 tabular-nums">{digLeader.digAttempts}</p>
                <p className="text-sm text-white font-medium mt-1 truncate">{digLeader.playerName}</p>
                <p className="text-xs text-gray-500">Digs</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player stats table */}
      {(matchPlayerStats.length > 0 || statsSorted.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-300">Player Stats</h2>
            <button onClick={handleExport} className="btn-ghost text-xs px-3 py-1.5 border border-gray-700 rounded-lg">
              Export CSV
            </button>
          </div>
          {/* Set selector toggle */}
          {completedSets.length > 0 && (
            <div className="flex gap-1 bg-gray-900 rounded-xl p-1 w-fit mb-3">
              <button
                onClick={() => setStatsSetId('')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${!statsSetId ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                All
              </button>
              {completedSets.map((s) => (
                <button
                  key={s.id as string}
                  onClick={() => setStatsSetId(s.id as string)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${statsSetId === s.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Set {s.set_number as number} — {s.home_score as number}:{s.away_score as number}
                </button>
              ))}
            </div>
          )}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs">
                  <th className="text-left p-3 font-normal">Player</th>
                  <th className="text-left p-3 font-normal">Pos</th>
                  <th className="text-right p-3 font-normal">K</th>
                  <th className="text-right p-3 font-normal">E</th>
                  <th className="text-right p-3 font-normal">TA</th>
                  <th className="text-right p-3 font-normal">Eff</th>
                  <th className="text-right p-3 font-normal">Ace</th>
                  <th className="text-right p-3 font-normal">Blk</th>
                  <th className="text-right p-3 font-normal">Dig</th>
                  <th className="text-right p-3 font-normal">Ast</th>
                </tr>
              </thead>
              <tbody>
                {statsSorted.map((p) => (
                  <tr key={p.playerId} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                    <td className="p-3 text-white font-medium">
                      <Link to={`/players/${p.playerId}`} className="hover:text-blue-400 transition-colors">
                        {p.playerName}
                      </Link>
                    </td>
                    <td className="p-3 text-gray-400">{p.position}</td>
                    <td className="p-3 text-right tabular-nums text-green-400 font-medium">{p.attackKills}</td>
                    <td className="p-3 text-right tabular-nums text-red-400">{p.attackErrors}</td>
                    <td className="p-3 text-right tabular-nums text-gray-300">{p.attackAttempts}</td>
                    <td className="p-3 text-right tabular-nums text-gray-300">{p.attackEfficiency.toFixed(3)}</td>
                    <td className="p-3 text-right tabular-nums text-blue-400">{p.serveAces}</td>
                    <td className="p-3 text-right tabular-nums text-purple-400">{p.soloBlocks + p.assistedBlocks}</td>
                    <td className="p-3 text-right tabular-nums text-yellow-400">{p.digAttempts}</td>
                    <td className="p-3 text-right tabular-nums text-gray-300">{p.setAssists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 mt-2">K=Kills · E=Errors · TA=Attempts · Blk=Blocks · Dig=Good Digs · Ast=Set Assists</p>
        </div>
      )}

      {/* Rotation Breakdown */}
      {completedSetIds.length > 0 && (homeTeamId || awayTeamId) && (
        <div>
          <h2 className="text-base font-semibold text-gray-300 mb-3">Rotation Breakdown</h2>
          <div className="card p-4 space-y-4">
            {/* Team + Set selectors */}
            <div className="flex flex-wrap gap-3">
              <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
                {([['home', homeTeamName], ['away', awayTeamName]] as const).map(([side, name]) => {
                  const tid = side === 'home' ? homeTeamId : awayTeamId
                  if (!tid) return null
                  return (
                    <button
                      key={side}
                      onClick={() => setRotationTeamSide(side)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${rotationTeamSide === side ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-1 bg-gray-900 rounded-xl p-1">
                {setList.filter((s) => s.status === 'complete').map((s) => (
                  <button
                    key={s.id as string}
                    onClick={() => setRotationSetId(s.id as string)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeRotationSetId === s.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Set {s.set_number as number}
                  </button>
                ))}
              </div>
            </div>

            {/* 6-slot table */}
            {rotationData.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-left border-b border-gray-700">
                        <th className="pb-2 pr-4 font-normal">Rotation</th>
                        <th className="pb-2 pr-4 text-right font-normal">Rallies</th>
                        <th className="pb-2 pr-4 text-right font-normal">Sideout %</th>
                        <th className="pb-2 pr-4 text-right font-normal">Scoring %</th>
                        <th className="pb-2 text-right font-normal">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rotationData.sort((a, b) => a.slot - b.slot).map((row) => {
                        const soColor = row.sideoutPct >= 0.6 ? 'text-green-400' : row.sideoutPct <= 0.4 ? 'text-red-400' : 'text-gray-300'
                        const scColor = row.scoringPct >= 0.6 ? 'text-green-400' : row.scoringPct <= 0.4 ? 'text-red-400' : 'text-gray-300'
                        return (
                          <tr key={row.slot} className="border-b border-gray-800 last:border-0">
                            <td className="py-2 pr-4 text-gray-300">{ROTATION_SLOT_LABELS[row.slot]}</td>
                            <td className="py-2 pr-4 text-right text-gray-400">{row.ralliesTotal}</td>
                            <td className={`py-2 pr-4 text-right tabular-nums font-medium ${soColor}`}>
                              {row.ralliesTotal > 0 ? `${(row.sideoutPct * 100).toFixed(0)}%` : '—'}
                            </td>
                            <td className={`py-2 pr-4 text-right tabular-nums font-medium ${scColor}`}>
                              {row.ralliesTotal > 0 ? `${(row.scoringPct * 100).toFixed(0)}%` : '—'}
                            </td>
                            <td className="py-2 text-right tabular-nums text-gray-300">{row.pointsScored}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Weakest rotation callout */}
                {(() => {
                  const withSideouts = rotationData.filter((r) => r.ralliesTotal > 0)
                  if (!withSideouts.length) return null
                  const weakest = withSideouts.reduce((a, b) => a.sideoutPct <= b.sideoutPct ? a : b)
                  return (
                    <p className="text-xs text-gray-500">
                      Weakest sideout: <span className="text-red-400">{ROTATION_SLOT_LABELS[weakest.slot]}</span> — {(weakest.sideoutPct * 100).toFixed(0)}%
                    </p>
                  )
                })()}
              </>
            ) : (
              <p className="text-sm text-gray-500">No rotation data for this set yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Rally Log */}
      {completedSetIds.length > 0 && (
        <div>
          <button
            onClick={() => setRallyLogOpen((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-base font-semibold text-gray-300">Rally Log</h2>
            {rallyLogOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {rallyLogOpen && (
            <div className="mt-3">
              {rallyLogSetId && (() => {
                const logSet = setList.find((s) => s.id === rallyLogSetId)
                return logSet ? (
                  <p className="text-xs text-gray-500 mb-2">
                    Set {logSet.set_number as number} — use the player stats selector above to switch sets
                  </p>
                ) : null
              })()}
              <div className="card divide-y divide-gray-800">
                {(rallyLogRallies as unknown as { id: string; rally_number: number; home_score_before: number; away_score_before: number; winning_team_id: string | null; point_type: string | null }[]).map((r) => {
                  const winnerId = r.winning_team_id
                  const winnerName = winnerId === homeTeamId ? homeTeamName : winnerId === awayTeamId ? awayTeamName : '?'
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="text-xs text-gray-600 w-6 shrink-0">#{r.rally_number}</span>
                      <span className="text-sm tabular-nums text-gray-400">
                        {r.home_score_before}–{r.away_score_before}
                      </span>
                      <span className="text-sm text-gray-300 flex-1">→ {winnerName}</span>
                      {r.point_type && (
                        <span className="text-xs text-gray-600">{r.point_type}</span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete rally #${r.rally_number}? This reverses the score.`)) {
                              deleteRally.mutate(r.id)
                            }
                          }}
                          disabled={deleteRally.isPending}
                          className="p-1 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                          title="Delete rally"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
                {rallyLogRallies.length === 0 && (
                  <p className="p-4 text-sm text-gray-500 text-center">No rallies recorded for this set.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {matchPlayerStats.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-gray-400">No stats recorded for this match yet.</p>
        </div>
      )}
    </div>
  )
}
