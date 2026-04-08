import { useState } from 'react'
import { downloadCsvRows } from '../../utils/csv'
import { useTeams } from '../../api/teams'
import { useTeamPlayers } from '../../api/players'
import { useSeasons, useTeamSideout, useAttackHeatMap, useDigHeatMap, useReceptionHeatMap, useMatchPlayerStats } from '../../api/stats'
import { useMatches } from '../../api/matches'
import { CourtSVG } from '../../components/court/CourtSVG'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function matchLabel(m: Record<string, unknown>): string {
  const date = new Date(m.match_date as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const opp = (m.opponent_name as string | null) ?? (m.away_team_name as string | null) ?? (m.home_team_name as string | null) ?? 'Unknown'
  return `${date} vs ${opp}`
}

export function StatsPage() {
  const { data: teams = [] } = useTeams()
  const [teamId, setTeamId] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [matchId, setMatchId] = useState('')
  const [playerId, setPlayerId] = useState('')

  const { data: players = [] } = useTeamPlayers(teamId)
  const { data: seasons = [] } = useSeasons(teamId)
  const { data: matches = [] } = useMatches(teamId ? { teamId, ...(seasonId ? { seasonId } : {}) } : undefined)

  const heatMapFilters = {
    teamId: teamId || undefined,
    playerId: playerId || undefined,
    seasonId: !matchId && seasonId ? seasonId : undefined,
    matchId: matchId || undefined,
  }

  const { data: attackPoints = [] } = useAttackHeatMap(heatMapFilters)
  const { data: digPoints = [] } = useDigHeatMap(heatMapFilters)
  const { data: receptionPoints = [] } = useReceptionHeatMap(heatMapFilters)
  const { data: sideout } = useTeamSideout({ teamId: teamId || undefined, seasonId: seasonId || undefined, matchId: matchId || undefined })
  const { data: matchPlayers = [] } = useMatchPlayerStats(matchId)

  const attackResultCounts = attackPoints.reduce<Record<string, number>>((acc, pt) => {
    acc[pt.result] = (acc[pt.result] ?? 0) + 1
    return acc
  }, {})

  const barData = [
    { name: 'Kill', value: attackResultCounts['kill'] ?? 0, color: '#10B981' },
    { name: 'Error', value: attackResultCounts['error'] ?? 0, color: '#EF4444' },
    { name: 'In Play', value: attackResultCounts['in_play'] ?? 0, color: '#FBBF24' },
    { name: 'Blocked', value: attackResultCounts['blocked'] ?? 0, color: '#F97316' },
  ]

  const totalAttacks = attackPoints.length
  const efficiency = totalAttacks > 0
    ? ((attackResultCounts['kill'] ?? 0) - (attackResultCounts['error'] ?? 0)) / totalAttacks
    : 0

  function handleTeamChange(id: string) {
    setTeamId(id)
    setSeasonId('')
    setMatchId('')
    setPlayerId('')
  }

  function handleSeasonChange(id: string) {
    setSeasonId(id)
    setMatchId('')
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Stats</h1>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <label className="label">Team</label>
          <select className="input" value={teamId} onChange={(e) => handleTeamChange(e.target.value)}>
            <option value="">All Teams</option>
            {(teams as unknown as Record<string, unknown>[]).map((t) => (
              <option key={t.id as string} value={t.id as string}>{t.name as string}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Season</label>
          <select className="input" value={seasonId} onChange={(e) => handleSeasonChange(e.target.value)} disabled={!teamId}>
            <option value="">All Seasons</option>
            {(seasons as unknown as Record<string, unknown>[]).map((s) => (
              <option key={s.id as string} value={s.id as string}>{s.name as string}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Match</label>
          <select className="input" value={matchId} onChange={(e) => setMatchId(e.target.value)} disabled={!teamId}>
            <option value="">All Matches</option>
            {(matches as unknown as Record<string, unknown>[]).map((m) => (
              <option key={m.id as string} value={m.id as string}>{matchLabel(m)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Player</label>
          <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)} disabled={!teamId}>
            <option value="">All Players</option>
            {(players as unknown as Record<string, unknown>[]).map((p) => (
              <option key={p.id as string} value={p.id as string}>{p.name as string}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary stat cards */}
      {(totalAttacks > 0 || (sideout && sideout.sideoutTotal > 0)) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {totalAttacks > 0 && (
            <>
              <div className="card p-4">
                <p className="stat-value">{efficiency.toFixed(3)}</p>
                <p className="stat-label">Attack Efficiency</p>
              </div>
              <div className="card p-4">
                <p className="stat-value">{totalAttacks}</p>
                <p className="stat-label">Total Attacks</p>
              </div>
            </>
          )}
          {sideout && sideout.sideoutTotal > 0 && (
            <>
              <div className="card p-4">
                <p className="stat-value">{(sideout.sideoutPct * 100).toFixed(1)}%</p>
                <p className="stat-label">Sideout %</p>
              </div>
              <div className="card p-4">
                <p className="stat-value">{sideout.sideoutWon}/{sideout.sideoutTotal}</p>
                <p className="stat-label">Sideouts Won/Total</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Attack result breakdown */}
      {totalAttacks > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Attack Results</h2>
            <button
              onClick={() => downloadCsvRows(
                'attack-stats.csv',
                ['Result', 'Count'],
                barData.map((r) => [r.name, r.value])
              )}
              className="btn-ghost text-xs px-3 py-1.5 border border-gray-700 rounded-lg"
            >
              Export CSV
            </button>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Heat maps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <h2 className="text-base font-semibold text-white mb-3">Attack Destinations</h2>
          <CourtSVG mode="heatmap" heatMapPoints={attackPoints} />
        </div>
        <div className="card p-4">
          <h2 className="text-base font-semibold text-white mb-3">Dig Positions</h2>
          <CourtSVG mode="heatmap" heatMapPoints={digPoints} />
        </div>
        <div className="card p-4">
          <h2 className="text-base font-semibold text-white mb-3">Serve Receive Positions</h2>
          <CourtSVG mode="heatmap" heatMapPoints={receptionPoints} />
          <p className="text-xs text-gray-500 mt-2">Green = perfect, yellow = ok, red = aced</p>
        </div>
      </div>

      {attackPoints.length === 0 && digPoints.length === 0 && receptionPoints.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-gray-400">No stat data yet. Enter rallies from a match to see stats here.</p>
        </div>
      )}

      {/* Per-player serve receive table — only shown when a match is selected */}
      {matchId && matchPlayers.filter((p) => p.passTotalAttempts > 0).length > 0 && (
        <div className="card p-4">
          <h2 className="text-base font-semibold text-white mb-4">Serve Receive by Player</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-700">
                  <th className="pb-2 pr-4">Player</th>
                  <th className="pb-2 pr-4 text-right">Attempts</th>
                  <th className="pb-2 pr-4 text-right">Avg Quality</th>
                  <th className="pb-2 text-right">Aced</th>
                </tr>
              </thead>
              <tbody>
                {matchPlayers
                  .filter((p) => p.passTotalAttempts > 0)
                  .sort((a, b) => b.passTotalAttempts - a.passTotalAttempts)
                  .map((p) => (
                    <tr key={p.playerId} className="border-b border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-white">{p.playerName}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{p.passTotalAttempts}</td>
                      <td className="py-2 pr-4 text-right text-gray-300">{p.passQualityAvg.toFixed(2)}</td>
                      <td className="py-2 text-right text-red-400">{p.passAced}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
