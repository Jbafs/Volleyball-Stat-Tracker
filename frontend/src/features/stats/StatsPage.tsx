import { useState, useMemo } from 'react'
import { useTeams } from '../../api/teams'
import { useTeamPlayers } from '../../api/players'
import {
  useAllSeasons,
  useTeamSideout,
  useAttackHeatMap,
  useDigHeatMap,
  useReceptionHeatMap,
  useMatchPlayerStats,
  useTeamPlayerStats,
  useSeasonLeaderboard,
  useSeasonTeamStats,
  useServeQualityDist,
} from '../../api/stats'
import { useMatches } from '../../api/matches'
import { HeatmapsTab } from './HeatmapsTab'
import { PlayersTab } from './PlayersTab'
import { TeamsTab } from './TeamsTab'
import type { PlayerStats, PlayerStatsWithTeam } from '@vst/shared'

type Tab = 'heatmaps' | 'players' | 'teams'

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
  const [tab, setTab] = useState<Tab>('heatmaps')

  const { data: teamPlayersRaw = [] } = useTeamPlayers(teamId)
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
  const { data: sideout } = useTeamSideout({
    teamId: teamId || undefined,
    seasonId: seasonId || undefined,
    matchId: matchId || undefined,
  })
  const { data: matchPlayers = [] } = useMatchPlayerStats(matchId)

  const statsScope = matchId ? 'match' : seasonId ? 'season' : undefined
  const statsScopeId = matchId || seasonId || undefined
  const { data: teamPlayers = [] } = useTeamPlayerStats(teamId, statsScope, statsScopeId)

  const showLeaderboard = !teamId && !!seasonId
  const { data: leaderboardPlayers = [] } = useSeasonLeaderboard(seasonId)
  const { data: seasonTeams = [] } = useSeasonTeamStats(seasonId)
  const { data: serveQualityBuckets = [] } = useServeQualityDist(heatMapFilters)

  const playerRows: PlayerStats[] | PlayerStatsWithTeam[] = showLeaderboard ? leaderboardPlayers : teamPlayers

  // Build player name map from team roster + match players
  const playerNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of teamPlayersRaw as unknown as { id: string; name: string }[]) {
      map.set(p.id, p.name)
    }
    for (const p of teamPlayers) {
      map.set(p.playerId, p.playerName)
    }
    for (const p of matchPlayers) {
      map.set(p.playerId, p.playerName)
    }
    return map
  }, [teamPlayersRaw, teamPlayers, matchPlayers])

  function handleTeamChange(id: string) {
    setTeamId(id)
    setSeasonId('')
    setMatchId('')
    setPlayerId('')
    setTab('heatmaps')
  }

  function handleSeasonChange(id: string) {
    setSeasonId(id)
    setMatchId('')
    // Auto-switch to players when no team is selected
    if (id && !teamId && tab === 'heatmaps') setTab('players')
  }

  const tabsConfig: { key: Tab; label: string }[] = [
    { key: 'heatmaps', label: 'Heatmaps' },
    { key: 'players', label: 'Players' },
    { key: 'teams', label: 'Teams' },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Stats</h1>

      {/* Filters */}
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
              {(teamPlayersRaw as unknown as Record<string, unknown>[]).map((p) => (
                <option key={p.id as string} value={p.id as string}>{p.name as string}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex bg-gray-900 rounded-xl p-1 gap-1 w-fit">
        {tabsConfig.map(({ key, label }) => {
          const disabled = key === 'teams' && !seasonId
          return (
            <button
              key={key}
              disabled={disabled}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                tab === key
                  ? 'bg-gray-700 text-white'
                  : disabled
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'heatmaps' && (
        <HeatmapsTab
          attackPoints={attackPoints}
          digPoints={digPoints}
          receptionPoints={receptionPoints}
          serveQualityBuckets={serveQualityBuckets}
          sideoutData={sideout}
          teamId={teamId}
          seasonId={seasonId}
          matchId={matchId}
          playerNames={playerNameMap}
          matchPlayers={matchPlayers}
        />
      )}

      {tab === 'players' && (
        <PlayersTab
          players={playerRows}
          showLeaderboard={showLeaderboard}
        />
      )}

      {tab === 'teams' && (
        <TeamsTab
          teams={seasonTeams}
          seasonId={seasonId}
        />
      )}
    </div>
  )
}
