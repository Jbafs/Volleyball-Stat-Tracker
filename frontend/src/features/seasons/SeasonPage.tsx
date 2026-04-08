import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTeam } from '../../api/teams'
import { useTeamPlayers } from '../../api/players'
import { useSeasons, useTeamSideout, usePlayerStats } from '../../api/stats'
import { useMatches } from '../../api/matches'
type MatchRow = Record<string, unknown>

function computeRecord(teamId: string, matches: MatchRow[]) {
  let wins = 0
  let losses = 0
  for (const m of matches) {
    const homeSets = (m.home_sets_won as number) ?? 0
    const awaySets = (m.away_sets_won as number) ?? 0
    if (m.home_team_id === teamId) {
      if (homeSets > awaySets) wins++
      else losses++
    } else {
      if (awaySets > homeSets) wins++
      else losses++
    }
  }
  return { wins, losses }
}

function PlayerStatRow({ playerId, playerName, position, seasonId }: {
  playerId: string; playerName: string; position: string; seasonId: string
}) {
  const { data: stats } = usePlayerStats(playerId, 'season', seasonId)
  if (!stats) return (
    <tr className="border-b border-gray-800 last:border-0">
      <td className="p-2 text-white font-medium">{playerName}</td>
      <td className="p-2 text-gray-400">{position}</td>
      <td colSpan={6} className="p-2 text-gray-600 text-sm">No data</td>
    </tr>
  )
  return (
    <tr className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
      <td className="p-2 text-white font-medium">
        <Link to={`/players/${playerId}`} className="hover:text-blue-400 transition-colors">
          {playerName}
        </Link>
      </td>
      <td className="p-2 text-gray-400">{position}</td>
      <td className="p-2 text-right tabular-nums text-green-400">{stats.attackKills}</td>
      <td className="p-2 text-right tabular-nums text-gray-300">{stats.attackEfficiency.toFixed(3)}</td>
      <td className="p-2 text-right tabular-nums text-blue-400">{stats.serveAces}</td>
      <td className="p-2 text-right tabular-nums text-gray-300">
        {stats.passTotalAttempts > 0 ? stats.passQualityAvg.toFixed(2) : '—'}
      </td>
      <td className="p-2 text-right tabular-nums text-yellow-400">{stats.digAttempts}</td>
      <td className="p-2 text-right tabular-nums text-gray-300">{stats.setAssists}</td>
    </tr>
  )
}

export function SeasonPage() {
  const { teamId, seasonId } = useParams<{ teamId: string; seasonId: string }>()
  const { data: team } = useTeam(teamId!)
  const { data: seasons = [] } = useSeasons(teamId!)
  const { data: players = [] } = useTeamPlayers(teamId!)
  const { data: completedMatches = [] } = useMatches({ teamId, seasonId, status: 'complete' })
  const { data: sideout } = useTeamSideout({ teamId, seasonId })

  const t = team as unknown as Record<string, unknown> | undefined
  const seasonRows = seasons as unknown as Record<string, unknown>[]
  const season = seasonRows.find((s) => (s.id as string) === seasonId)
  const matches = completedMatches as unknown as MatchRow[]
  const activePlayers = (players as unknown as Record<string, unknown>[]).filter((p) => p.is_active)
  const { wins, losses } = teamId ? computeRecord(teamId, matches) : { wins: 0, losses: 0 }

  if (!season) return <div className="p-6 text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/teams/${teamId}`} className="btn-ghost gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> {t?.name as string ?? 'Team'}
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{season.name as string}</h1>
          {((season.start_date as string | null) || (season.end_date as string | null)) && (
            <p className="text-gray-400 text-sm">
              {(season.start_date as string | null) ?? '?'} – {(season.end_date as string | null) ?? 'present'}
            </p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold tabular-nums">
            <span className="text-green-400">{wins}</span>
            <span className="text-gray-600">–</span>
            <span className="text-red-400">{losses}</span>
          </p>
          <p className="text-gray-400 text-sm mt-1">Record</p>
        </div>
        <div className="card p-4 text-center">
          <p className="stat-value">{matches.length}</p>
          <p className="stat-label">Matches Played</p>
        </div>
        {sideout && sideout.sideoutTotal > 0 && (
          <>
            <div className="card p-4 text-center">
              <p className="stat-value">{(sideout.sideoutPct * 100).toFixed(1)}%</p>
              <p className="stat-label">Sideout %</p>
            </div>
            <div className="card p-4 text-center">
              <p className="stat-value">{sideout.sideoutWon}/{sideout.sideoutTotal}</p>
              <p className="stat-label">Sideouts Won</p>
            </div>
          </>
        )}
      </div>

      {/* Match results */}
      {matches.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-300 mb-3">Results</h2>
          <div className="card divide-y divide-gray-800">
            {matches.map((m) => {
              const homeWon = (m.home_sets_won as number ?? 0) > (m.away_sets_won as number ?? 0)
              const home = (m.home_team_name as string | null) ?? 'Home'
              const away = (m.away_team_name as string | null) ?? (m.opponent_name as string | null) ?? 'Away'
              return (
                <Link
                  key={m.id as string}
                  to={`/matches/${m.id as string}/recap`}
                  className="flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
                >
                  <div>
                    <p className="text-white font-medium">{home} vs {away}</p>
                    <p className="text-xs text-gray-500">{m.match_date as string}</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    <span className={homeWon ? 'text-green-400' : 'text-gray-300'}>{m.home_sets_won as number ?? 0}</span>
                    <span className="text-gray-600">–</span>
                    <span className={!homeWon ? 'text-green-400' : 'text-gray-300'}>{m.away_sets_won as number ?? 0}</span>
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-gray-400">No completed matches in this season yet.</p>
        </div>
      )}

      {/* Per-player stats */}
      {activePlayers.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-300 mb-3">Player Stats</h2>
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
                {activePlayers.map((p) => (
                  <PlayerStatRow
                    key={p.id as string}
                    playerId={p.id as string}
                    playerName={p.name as string}
                    position={p.position as string}
                    seasonId={seasonId!}
                  />
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-600 p-2">K=Kills · Eff=Efficiency · Ace=Serve Aces · Rec Avg=Reception Quality · Dig=Dig Attempts · Ast=Set Assists</p>
          </div>
        </div>
      )}
    </div>
  )
}
