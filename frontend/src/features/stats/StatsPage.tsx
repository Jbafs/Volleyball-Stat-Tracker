import { useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadCsvRows } from '../../utils/csv'
import { useTeams } from '../../api/teams'
import { useTeamPlayers } from '../../api/players'
import { useAllSeasons, useTeamSideout, useAttackHeatMap, useDigHeatMap, useReceptionHeatMap, useMatchPlayerStats, useTeamPlayerStats } from '../../api/stats'
import { useMatches } from '../../api/matches'
import { CourtSVG } from '../../components/court/CourtSVG'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { PlayerStats } from '@vst/shared'

function matchLabel(m: Record<string, unknown>): string {
  const date = new Date(m.match_date as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const opp = (m.opponent_name as string | null) ?? (m.away_team_name as string | null) ?? (m.home_team_name as string | null) ?? 'Unknown'
  return `${date} vs ${opp}`
}

type SortKey = 'playerName' | 'attackEfficiency' | 'attackKills' | 'serveAces' | 'passQualityAvg' | 'digAttempts'

const SORT_COLS: { key: SortKey; label: string }[] = [
  { key: 'playerName', label: 'Player' },
  { key: 'attackEfficiency', label: 'Atk Eff' },
  { key: 'attackKills', label: 'Kills' },
  { key: 'serveAces', label: 'Aces' },
  { key: 'passQualityAvg', label: 'Rcv Avg' },
  { key: 'digAttempts', label: 'Digs' },
]

export function StatsPage() {
  const { data: teams = [] } = useTeams()
  const [teamId, setTeamId] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [matchId, setMatchId] = useState('')
  const [playerId, setPlayerId] = useState('')
  const [heatmapTab, setHeatmapTab] = useState<'attack' | 'dig' | 'receive'>('attack')
  const [view, setView] = useState<'heatmaps' | 'players'>('heatmaps')
  const [sortKey, setSortKey] = useState<SortKey>('attackEfficiency')
  const [sortDesc, setSortDesc] = useState(true)

  const { data: players = [] } = useTeamPlayers(teamId)
  const { data: allSeasons = [] } = useAllSeasons()
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

  const statsScope = matchId ? 'match' : seasonId ? 'season' : undefined
  const statsScopeId = matchId || seasonId || undefined
  const { data: teamPlayers = [] } = useTeamPlayerStats(teamId, statsScope, statsScopeId)

  const sortedPlayers = [...teamPlayers].sort((a, b) => {
    const av = a[sortKey as keyof PlayerStats] as number | string
    const bv = b[sortKey as keyof PlayerStats] as number | string
    if (typeof av === 'string') return sortDesc ? (bv as string).localeCompare(av) : av.localeCompare(bv as string)
    return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number)
  })

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
    setView('heatmaps')
  }

  function handleSeasonChange(id: string) {
    setSeasonId(id)
    setMatchId('')
  }

  function handleSortCol(key: SortKey) {
    if (sortKey === key) {
      setSortDesc((d) => !d)
    } else {
      setSortKey(key)
      setSortDesc(key !== 'playerName')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Stats</h1>

      {/* Filters — single column on mobile, 4-col on sm+ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
          <select className="input" value={seasonId} onChange={(e) => handleSeasonChange(e.target.value)}>
            <option value="">All Seasons</option>
            {(allSeasons as unknown as Record<string, unknown>[]).map((s) => (
              <option key={s.id as string} value={s.id as string}>{s.name as string}</option>
            ))}
          </select>
        </div>

        {teamId && (
          <div>
            <label className="label">Match</label>
            <select className="input" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
              <option value="">All Matches</option>
              {(matches as unknown as Record<string, unknown>[]).map((m) => (
                <option key={m.id as string} value={m.id as string}>{matchLabel(m)}</option>
              ))}
            </select>
          </div>
        )}

        {teamId && (
          <div>
            <label className="label">Player</label>
            <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
              <option value="">All Players</option>
              {(players as unknown as Record<string, unknown>[]).map((p) => (
                <option key={p.id as string} value={p.id as string}>{p.name as string}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* View toggle — only shown when a team is selected */}
      {teamId && (
        <div className="flex bg-gray-900 rounded-xl p-1 w-fit gap-1">
          {(['heatmaps', 'players'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                view === v ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {v === 'heatmaps' ? 'Heatmaps' : 'Players'}
            </button>
          ))}
        </div>
      )}

      {/* Summary stat cards */}
      {(totalAttacks > 0 || (sideout && sideout.sideoutTotal > 0)) && view === 'heatmaps' && (
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

      {view === 'heatmaps' && (
        <>
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
          {/* Mobile pill-bar: only one heatmap visible at a time */}
          <div className="flex sm:hidden bg-gray-900 rounded-xl p-1 w-fit gap-1">
            {(['attack', 'dig', 'receive'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setHeatmapTab(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  heatmapTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'attack' ? 'Attack' : tab === 'dig' ? 'Dig' : 'Receive'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`card p-4 ${heatmapTab !== 'attack' ? 'hidden sm:block' : ''}`}>
              <h2 className="text-base font-semibold text-white mb-3">Attack Destinations</h2>
              <CourtSVG mode="heatmap" heatMapPoints={attackPoints} />
            </div>
            <div className={`card p-4 ${heatmapTab !== 'dig' ? 'hidden sm:block' : ''}`}>
              <h2 className="text-base font-semibold text-white mb-3">Dig Positions</h2>
              <CourtSVG mode="heatmap" heatMapPoints={digPoints} />
            </div>
            <div className={`card p-4 ${heatmapTab !== 'receive' ? 'hidden sm:block' : ''}`}>
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

          {/* Per-player serve receive table — shown when match data with pass attempts is available */}
          {matchPlayers.filter((p) => p.passTotalAttempts > 0).length > 0 && (
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
        </>
      )}

      {view === 'players' && (
        <div className="card p-4">
          <h2 className="text-base font-semibold text-white mb-4">Player Breakdown</h2>
          {sortedPlayers.length === 0 ? (
            <p className="text-gray-400 text-sm">No player data for the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-700">
                    {SORT_COLS.map(({ key, label }) => (
                      <th
                        key={key}
                        className={`pb-2 pr-4 font-normal cursor-pointer select-none hover:text-white transition-colors ${
                          sortKey === key ? 'text-blue-300' : 'text-gray-400'
                        } ${key !== 'playerName' ? 'text-right' : ''}`}
                        onClick={() => handleSortCol(key)}
                      >
                        {label}{sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((p) => (
                    <tr key={p.playerId} className="border-b border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-white">
                        <Link to={`/players/${p.playerId}`} className="hover:text-blue-400 transition-colors">
                          {p.playerName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300 tabular-nums">
                        {p.attackAttempts > 0 ? p.attackEfficiency.toFixed(3) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300 tabular-nums">{p.attackKills}</td>
                      <td className="py-2 pr-4 text-right text-gray-300 tabular-nums">{p.serveAces}</td>
                      <td className="py-2 pr-4 text-right text-gray-300 tabular-nums">
                        {p.passTotalAttempts > 0 ? p.passQualityAvg.toFixed(2) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300 tabular-nums">{p.digAttempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
