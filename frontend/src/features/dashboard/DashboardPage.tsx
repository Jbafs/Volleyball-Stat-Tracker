import { Link } from 'react-router-dom'
import { useTeams } from '../../api/teams'
import { useMatches } from '../../api/matches'
import { useSeasons } from '../../api/stats'
import { Calendar, Users, Activity, ArrowRight } from 'lucide-react'
import type { Team } from '@vst/shared'

type MatchRow = Record<string, unknown>

function matchOpponents(m: MatchRow) {
  const home = (m.home_team_name as string | null) ?? 'Home'
  const away = (m.away_team_name as string | null) ?? (m.opponent_name as string | null) ?? 'Away'
  return `${home} vs ${away}`
}

/** Computes W-L record for a team given a list of completed matches with home/away_sets_won. */
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

function TeamRecordRow({ team }: { team: Team }) {
  const { data: seasons = [] } = useSeasons(team.id)
  const seasonRows = seasons as unknown as Record<string, unknown>[]
  const latestSeason = seasonRows[seasonRows.length - 1]
  const seasonId = latestSeason ? (latestSeason.id as string) : undefined

  const { data: completedMatches = [] } = useMatches(
    seasonId ? { teamId: team.id, seasonId, status: 'complete' } : { teamId: team.id, status: 'complete' }
  )
  const matches = completedMatches as unknown as MatchRow[]
  const { wins, losses } = computeRecord(team.id, matches)

  if (matches.length === 0) return null

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <div>
        <p className="text-white font-medium">{team.name}</p>
        {latestSeason && (
          <p className="text-xs text-gray-500">{latestSeason.name as string}</p>
        )}
      </div>
      <div className="text-right">
        <p className="text-lg font-bold tabular-nums">
          <span className="text-green-400">{wins}</span>
          <span className="text-gray-600">–</span>
          <span className="text-red-400">{losses}</span>
        </p>
        <p className="text-xs text-gray-500">{matches.length} matches</p>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data: teams = [] } = useTeams()
  const { data: inProgressMatches = [] } = useMatches({ status: 'in_progress' })
  const { data: completedMatches = [] } = useMatches({ status: 'complete', limit: 5 })
  const { data: allMatches = [] } = useMatches()

  const inProgress = inProgressMatches as unknown as MatchRow[]
  const recentCompleted = completedMatches as unknown as MatchRow[]
  const singleInProgress = inProgress.length === 1 ? inProgress[0] : null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Volleyball Stat Tracker</p>
      </div>

      {/* Continue entry CTA */}
      {singleInProgress && (
        <Link
          to={`/matches/${singleInProgress.id}`}
          className="card p-4 flex items-center justify-between border-blue-700 hover:border-blue-500 transition-colors block"
        >
          <div>
            <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-1">In Progress</p>
            <p className="text-white font-semibold">{matchOpponents(singleInProgress)}</p>
            <p className="text-sm text-gray-400">{singleInProgress.match_date as string}</p>
          </div>
          <div className="flex items-center gap-2 text-blue-400 font-medium">
            Continue Entry <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-400" />
            <div>
              <p className="stat-value">{teams.length}</p>
              <p className="stat-label">Teams</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-green-400" />
            <div>
              <p className="stat-value">{(allMatches as unknown[]).length}</p>
              <p className="stat-label">Matches</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-orange-400" />
            <div>
              <p className="stat-value">{inProgress.length}</p>
              <p className="stat-label">In Progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Multiple in-progress matches */}
      {inProgress.length > 1 && (
        <div>
          <h2 className="text-base font-semibold text-gray-300 mb-3">In Progress</h2>
          <div className="space-y-2">
            {inProgress.map((m) => (
              <Link
                key={m.id as string}
                to={`/matches/${m.id}`}
                className="card p-4 flex items-center justify-between hover:border-blue-700 transition-colors block"
              >
                <div>
                  <p className="font-medium text-white">{matchOpponents(m)}</p>
                  <p className="text-sm text-gray-400">{m.match_date as string}</p>
                </div>
                <span className="badge bg-green-900 text-green-300">In Progress</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent results */}
      {recentCompleted.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-300 mb-3">Recent Results</h2>
          <div className="card divide-y divide-gray-800">
            {recentCompleted.map((m) => {
              const homeWon = (m.home_sets_won as number ?? 0) > (m.away_sets_won as number ?? 0)
              return (
                <Link
                  key={m.id as string}
                  to={`/matches/${m.id}/recap`}
                  className="flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
                >
                  <div>
                    <p className="text-white font-medium">{matchOpponents(m)}</p>
                    <p className="text-xs text-gray-500">{m.match_date as string}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">
                      <span className={homeWon ? 'text-green-400' : 'text-gray-300'}>{m.home_sets_won as number ?? 0}</span>
                      <span className="text-gray-600">–</span>
                      <span className={!homeWon ? 'text-green-400' : 'text-gray-300'}>{m.away_sets_won as number ?? 0}</span>
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
          <Link to="/matches?status=complete" className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block">
            View all completed matches →
          </Link>
        </div>
      )}

      {/* Team season records */}
      {teams.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-300 mb-3">Team Records</h2>
          <div className="card p-4">
            {teams.map((team) => (
              <TeamRecordRow key={team.id} team={team} />
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-base font-semibold text-gray-300 mb-3">Quick Actions</h2>
        <div className="flex gap-3">
          <Link to="/teams" className="btn-secondary">Manage Teams</Link>
          <Link to="/matches" className="btn-primary">View Matches</Link>
        </div>
      </div>
    </div>
  )
}
