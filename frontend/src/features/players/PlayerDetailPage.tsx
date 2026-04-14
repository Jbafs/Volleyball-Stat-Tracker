import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePlayer } from '../../api/players'
import { usePlayerStats, useAllSeasons } from '../../api/stats'
import { useMatches } from '../../api/matches'
import { downloadCsvRows } from '../../utils/csv'
import { POSITION_LABELS } from '@vst/shared'
import type { PlayerStats } from '@vst/shared'

type StatKey = keyof Omit<PlayerStats, 'playerId' | 'playerName' | 'position'>

const STAT_SECTIONS: { label: string; rows: { key: StatKey; label: string; decimals?: number; sub?: string }[] }[] = [
  {
    label: 'Attacking',
    rows: [
      { key: 'attackEfficiency', label: 'Efficiency', decimals: 3 },
      { key: 'attackKills', label: 'Kills' },
      { key: 'attackErrors', label: 'Errors' },
      { key: 'attackAttempts', label: 'Attempts' },
    ],
  },
  {
    label: 'Serving',
    rows: [
      { key: 'serveQualityAvg', label: 'Avg Quality', decimals: 2, sub: '0-4' },
      { key: 'serveAces', label: 'Aces' },
      { key: 'serveErrors', label: 'Errors' },
      { key: 'serveTotalAttempts', label: 'Attempts' },
    ],
  },
  {
    label: 'Serve Receive',
    rows: [
      { key: 'passQualityAvg', label: 'Avg Quality', decimals: 2, sub: '0-3' },
      { key: 'passAced', label: 'Aced' },
      { key: 'passTotalAttempts', label: 'Attempts' },
    ],
  },
  {
    label: 'Setting',
    rows: [
      { key: 'setAssists', label: 'Assists' },
      { key: 'setErrors', label: 'Errors' },
      { key: 'setTotalAttempts', label: 'Total' },
    ],
  },
  {
    label: 'Defense (Digs)',
    rows: [
      { key: 'digAttempts', label: 'Attempts' },
      { key: 'digQualityAvg', label: 'Avg Quality', decimals: 2, sub: '0-3' },
    ],
  },
  {
    label: 'Freeball Handling',
    rows: [
      { key: 'freeballAttempts', label: 'Attempts' },
      { key: 'freeballQualityAvg', label: 'Avg Quality', decimals: 2, sub: '0-3' },
    ],
  },
  {
    label: 'Block Cover',
    rows: [
      { key: 'blockCoverAttempts', label: 'Attempts' },
      { key: 'blockCoverQualityAvg', label: 'Avg Quality', decimals: 2, sub: '0-3' },
    ],
  },
  {
    label: 'Overpasses',
    rows: [
      { key: 'overpassAttempts', label: 'Total' },
      { key: 'overpassErrors', label: 'Errors' },
    ],
  },
  {
    label: 'Blocking',
    rows: [
      { key: 'soloBlocks', label: 'Solo Blocks' },
      { key: 'assistedBlocks', label: 'Assisted' },
      { key: 'blockTouches', label: 'Touches' },
      { key: 'blockErrors', label: 'Errors' },
    ],
  },
]

function fmt(val: number, decimals?: number) {
  return decimals !== undefined ? val.toFixed(decimals) : val.toString()
}

function matchLabel(m: Record<string, unknown>): string {
  const date = new Date(m.match_date as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const opp = (m.opponent_name as string | null) ?? (m.away_team_name as string | null) ?? (m.home_team_name as string | null) ?? 'Unknown'
  return `${date} vs ${opp}`
}

export function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>()
  const navigate = useNavigate()
  const { data: player } = usePlayer(playerId!)
  const { data: career } = usePlayerStats(playerId!, 'career')
  const [matchId, setMatchId] = useState('')
  const [seasonId, setSeasonId] = useState('')

  const p = player as unknown as Record<string, unknown> | undefined
  const teamId = (p?.team_id as string | undefined) ?? ''

  const { data: matches = [] } = useMatches(teamId ? { teamId } : undefined)
  const { data: allSeasons = [] } = useAllSeasons()
  const seasonRows = allSeasons as unknown as Record<string, unknown>[]

  const { data: matchStats } = usePlayerStats(playerId!, 'match', matchId || undefined)
  const { data: seasonStats } = usePlayerStats(playerId!, 'season', seasonId || undefined)

  function handleMatchChange(val: string) {
    setMatchId(val)
    if (val) setSeasonId('')
  }

  function handleSeasonChange(val: string) {
    setSeasonId(val)
    if (val) setMatchId('')
  }

  const showMatchComparison = !!matchId && !!matchStats && !!career
  const showSeasonComparison = !!seasonId && !!seasonStats && !!career
  const showComparison = showMatchComparison || showSeasonComparison
  const activeStats = showMatchComparison ? matchStats : showSeasonComparison ? seasonStats : null

  function handleExport() {
    const src = activeStats ?? career
    if (!src) return
    const label = matchId ? 'match' : seasonId ? 'season' : 'career'
    downloadCsvRows(
      `${(p!.name as string).replace(/\s+/g, '-')}-${label}.csv`,
      ['Stat', 'Value'],
      [
        ['Attack Efficiency', src.attackEfficiency.toFixed(3)],
        ['Kills', src.attackKills], ['Attack Errors', src.attackErrors], ['Attack Attempts', src.attackAttempts],
        ['Aces', src.serveAces], ['Serve Errors', src.serveErrors], ['Serve Attempts', src.serveTotalAttempts],
        ['Receive Avg Quality', src.passQualityAvg.toFixed(2)], ['Receive Attempts', src.passTotalAttempts],
        ['Dig Attempts', src.digAttempts], ['Dig Avg Quality', src.digQualityAvg.toFixed(2)],
        ['Freeball Attempts', src.freeballAttempts], ['Freeball Avg Quality', src.freeballQualityAvg.toFixed(2)],
        ['Block Cover Attempts', src.blockCoverAttempts], ['Block Cover Avg Quality', src.blockCoverQualityAvg.toFixed(2)],
        ['Overpass Attempts', src.overpassAttempts], ['Overpass Errors', src.overpassErrors],
        ['Set Assists', src.setAssists], ['Set Errors', src.setErrors],
        ['Solo Blocks', src.soloBlocks], ['Assisted Blocks', src.assistedBlocks],
      ]
    )
  }

  if (!player) return <div className="p-6 text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
        ← Back
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white">
            {p!.number !== null ? `${p!.number}` : '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{p!.name as string}</h1>
            <p className="text-gray-400">{POSITION_LABELS[p!.position as string]}</p>
          </div>
        </div>
        {career && (
          <button onClick={handleExport} className="btn-ghost text-xs px-3 py-1.5 border border-gray-700 rounded-lg">
            Export CSV
          </button>
        )}
      </div>

      {/* Scope filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {(matches as unknown as Record<string, unknown>[]).length > 0 && (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <label className="label shrink-0">View match:</label>
            <select
              className="input max-w-xs"
              value={matchId}
              onChange={(e) => handleMatchChange(e.target.value)}
            >
              <option value="">—</option>
              {(matches as unknown as Record<string, unknown>[]).map((m) => (
                <option key={m.id as string} value={m.id as string}>{matchLabel(m)}</option>
              ))}
            </select>
          </div>
        )}
        {seasonRows.length > 0 && (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <label className="label shrink-0">View season:</label>
            <select
              className="input max-w-xs"
              value={seasonId}
              onChange={(e) => handleSeasonChange(e.target.value)}
            >
              <option value="">—</option>
              {seasonRows.map((s) => (
                <option key={s.id as string} value={s.id as string}>{s.name as string}</option>
              ))}
            </select>
          </div>
        )}
        {!showComparison && <span className="text-xs text-gray-500 self-center">Showing career stats</span>}
      </div>

      {/* Stats — comparison table when a scope is selected, single column (career) otherwise */}
      {career && (
        <div className="space-y-6">
          {showComparison && (
            <div className="card p-3 flex flex-wrap gap-4 text-sm">
              {showMatchComparison && (
                <span className="text-gray-400">
                  Match: <span className="text-white font-medium">{matchLabel((matches as unknown as Record<string, unknown>[]).find(m => (m.id as string) === matchId)!)}</span>
                </span>
              )}
              {showSeasonComparison && (
                <span className="text-gray-400">
                  Season: <span className="text-white font-medium">{(seasonRows.find(s => (s.id as string) === seasonId)?.name as string | undefined) ?? ''}</span>
                </span>
              )}
              <span className="text-blue-400 font-medium">Left = selected &nbsp;|&nbsp; Right = career</span>
            </div>
          )}

          {STAT_SECTIONS.map(({ label, rows }) => {
            const hasData = rows.some((r) => (career[r.key] as number) > 0 || (showComparison && (activeStats![r.key] as number) > 0))
            if (!hasData) return null
            return (
              <div key={label}>
                <h2 className="text-base font-semibold text-gray-300 mb-3">{label}</h2>
                {showComparison ? (
                  <div className="card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left p-3 text-gray-400 font-normal">Stat</th>
                          <th className="text-right p-3 text-blue-300 font-semibold">{showMatchComparison ? 'This Match' : 'This Season'}</th>
                          <th className="text-right p-3 text-gray-400 font-normal">Career</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.key} className="border-b border-gray-800 last:border-0">
                            <td className="p-3 text-gray-300">
                              {r.label}
                              {r.sub && <span className="text-xs text-gray-600 ml-1">({r.sub})</span>}
                            </td>
                            <td className="p-3 text-right text-white font-medium tabular-nums">
                              {fmt(activeStats![r.key] as number, r.decimals)}
                            </td>
                            <td className="p-3 text-right text-gray-400 tabular-nums">
                              {fmt(career[r.key] as number, r.decimals)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3">
                    {rows.map((r) => (
                      <div key={r.key} className="card p-4 text-center">
                        <p className="stat-value">{fmt(career[r.key] as number, r.decimals)}</p>
                        <p className="stat-label">{r.label}</p>
                        {r.sub && <p className="text-xs text-gray-600 mt-0.5">{r.sub}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!career && (
        <div className="card p-6 text-center">
          <p className="text-gray-400">No stats recorded yet for this player.</p>
        </div>
      )}

      {(matchId && !matchStats) && (
        <div className="card p-6 text-center">
          <p className="text-gray-400">No stats recorded for this player in the selected match.</p>
        </div>
      )}

      {(seasonId && !seasonStats) && (
        <div className="card p-6 text-center">
          <p className="text-gray-400">No stats recorded for this player in the selected season.</p>
        </div>
      )}
    </div>
  )
}
