import type { D1Database } from '@cloudflare/workers-types'
import { query } from '../db/client'
import type { PlayerStats, PlayerStatsWithTeam, TeamStats, ServeQualityBucket, RotationBreakdown, HeatMapPoint } from '@vst/shared'

interface RawActionRow {
  player_id: string | null
  player_name: string
  position: string
  action_type: string
  pass_context: string | null
  serve_quality: number | null
  pass_quality: number | null
  set_type: string | null
  set_quality: string | null
  is_assist: number | null
  attack_result: string | null
  block_result: string | null
  dig_result: string | null
  freeball_result: string | null
  dest_x: number | null
  dest_y: number | null
  dig_x: number | null
  dig_y: number | null
}

function buildMatchFilter(scope: string, id: string): { condition: string; param: string } {
  switch (scope) {
    case 'season':
      return { condition: 'm.season_id = ?', param: id }
    case 'match':
      return { condition: 's.match_id = ?', param: id }
    case 'set':
      return { condition: 'ra.set_id = ?', param: id }
    default:
      return { condition: '1=1', param: id }
  }
}

const ACTION_COLUMNS = `
      ra.player_id,
      p.name AS player_name,
      p.position,
      ra.action_type,
      ra.pass_context,
      ra.serve_quality,
      ra.pass_quality,
      ra.set_type,
      ra.set_quality,
      ra.is_assist,
      ra.attack_result,
      ra.block_result,
      ra.dig_result,
      ra.freeball_result,
      ra.dest_x,
      ra.dest_y,
      ra.dig_x,
      ra.dig_y`

const ACTION_JOINS = `
    JOIN players p ON p.id = ra.player_id
    JOIN rallies r ON r.id = ra.rally_id
    JOIN sets s ON s.id = r.set_id
    JOIN matches m ON m.id = s.match_id`

function aggregateRows(playerId: string, rows: RawActionRow[]): PlayerStats {
  const first = rows[0]
  const stats: PlayerStats = {
    playerId,
    playerName: first.player_name,
    position: first.position as PlayerStats['position'],
    serveTotalAttempts: 0, serveErrors: 0, serveAces: 0, serveQualityAvg: 0,
    passTotalAttempts: 0, passQualityAvg: 0, passAced: 0,
    digAttempts: 0, digQualityAvg: 0,
    freeballAttempts: 0, freeballQualityAvg: 0,
    blockCoverAttempts: 0, blockCoverQualityAvg: 0,
    overpassAttempts: 0, overpassErrors: 0,
    setAssists: 0, setErrors: 0, setTotalAttempts: 0,
    attackAttempts: 0, attackKills: 0, attackErrors: 0, attackEfficiency: 0,
    soloBlocks: 0, assistedBlocks: 0, blockTouches: 0, blockErrors: 0,
  }
  let serveQualitySum = 0
  let passQualitySum = 0
  let digQualitySum = 0
  let freeballQualitySum = 0
  let blockCoverQualitySum = 0

  for (const row of rows) {
    switch (row.action_type) {
      case 'serve':
        stats.serveTotalAttempts++
        if (row.serve_quality === 0) stats.serveErrors++
        if (row.serve_quality === 4) stats.serveAces++
        serveQualitySum += row.serve_quality ?? 0
        break
      case 'reception':
        // Serve receive — populates the passTotalAttempts / passQualityAvg / passAced bucket
        stats.passTotalAttempts++
        if (row.pass_quality === 0) stats.passAced++
        passQualitySum += row.pass_quality ?? 0
        break
      case 'pass':
        // Defensive pass — split by context; NULL context (legacy) is silently skipped
        if (row.pass_context === 'dig') {
          stats.digAttempts++
          digQualitySum += row.pass_quality ?? 0
        } else if (row.pass_context === 'freeball') {
          stats.freeballAttempts++
          freeballQualitySum += row.pass_quality ?? 0
        } else if (row.pass_context === 'block_cover') {
          stats.blockCoverAttempts++
          blockCoverQualitySum += row.pass_quality ?? 0
        }
        break
      case 'overpass':
        stats.overpassAttempts++
        if (row.freeball_result === 'error') stats.overpassErrors++
        break
      case 'set':
        stats.setTotalAttempts++
        if (row.is_assist === 1) stats.setAssists++
        if (row.set_quality === 'error') stats.setErrors++
        break
      case 'attack':
        stats.attackAttempts++
        if (row.attack_result === 'kill') stats.attackKills++
        if (row.attack_result === 'error') stats.attackErrors++
        break
      case 'block':
        if (row.block_result === 'solo_block') stats.soloBlocks++
        else if (row.block_result === 'assisted_block') stats.assistedBlocks++
        else if (row.block_result === 'block_touch') stats.blockTouches++
        else if (row.block_result === 'block_error') stats.blockErrors++
        break
    }
  }

  if (stats.serveTotalAttempts > 0)
    stats.serveQualityAvg = serveQualitySum / stats.serveTotalAttempts
  if (stats.passTotalAttempts > 0)
    stats.passQualityAvg = passQualitySum / stats.passTotalAttempts
  if (stats.digAttempts > 0)
    stats.digQualityAvg = digQualitySum / stats.digAttempts
  if (stats.freeballAttempts > 0)
    stats.freeballQualityAvg = freeballQualitySum / stats.freeballAttempts
  if (stats.blockCoverAttempts > 0)
    stats.blockCoverQualityAvg = blockCoverQualitySum / stats.blockCoverAttempts
  if (stats.attackAttempts > 0)
    stats.attackEfficiency = (stats.attackKills - stats.attackErrors) / stats.attackAttempts

  return stats
}

export async function getPlayerStats(
  db: D1Database,
  playerId: string,
  scope: 'career' | 'season' | 'match' | 'set' = 'career',
  scopeId?: string
): Promise<PlayerStats | null> {
  const params: string[] = [playerId]
  let whereClause = 'ra.player_id = ?'
  if (scope !== 'career' && scopeId) {
    const filter = buildMatchFilter(scope, scopeId)
    whereClause += ` AND ${filter.condition}`
    params.push(filter.param)
  }

  const rows = await query<RawActionRow>(
    db,
    `SELECT ${ACTION_COLUMNS}
    FROM rally_actions ra ${ACTION_JOINS}
    WHERE ${whereClause}`,
    params
  )

  if (rows.length === 0) return null
  return aggregateRows(playerId, rows)
}

export async function getTeamPlayerStats(
  db: D1Database,
  teamId: string,
  scope: 'career' | 'season' | 'match' = 'career',
  scopeId?: string
): Promise<PlayerStats[]> {
  const params: string[] = [teamId]
  let whereClause = 'ra.team_id = ? AND ra.player_id IS NOT NULL'
  if (scope !== 'career' && scopeId) {
    const filter = buildMatchFilter(scope, scopeId)
    whereClause += ` AND ${filter.condition}`
    params.push(filter.param)
  }

  const rows = await query<RawActionRow & { player_id: string }>(
    db,
    `SELECT ${ACTION_COLUMNS}
    FROM rally_actions ra ${ACTION_JOINS}
    WHERE ${whereClause}`,
    params
  )

  const grouped = new Map<string, RawActionRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.player_id) ?? []
    list.push(row)
    grouped.set(row.player_id, list)
  }

  return Array.from(grouped.entries()).map(([pid, pRows]) => aggregateRows(pid, pRows))
}

export async function getMatchPlayerStats(
  db: D1Database,
  matchId: string
): Promise<PlayerStats[]> {
  const rows = await query<RawActionRow & { player_id: string }>(
    db,
    `SELECT ${ACTION_COLUMNS}
    FROM rally_actions ra ${ACTION_JOINS}
    WHERE s.match_id = ? AND ra.player_id IS NOT NULL`,
    [matchId]
  )

  const grouped = new Map<string, RawActionRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.player_id) ?? []
    list.push(row)
    grouped.set(row.player_id, list)
  }

  return Array.from(grouped.entries()).map(([pid, pRows]) => aggregateRows(pid, pRows))
}

export async function getSetPlayerStats(
  db: D1Database,
  setId: string
): Promise<PlayerStats[]> {
  const rows = await query<RawActionRow & { player_id: string }>(
    db,
    `SELECT ${ACTION_COLUMNS}
    FROM rally_actions ra ${ACTION_JOINS}
    WHERE r.set_id = ? AND ra.player_id IS NOT NULL`,
    [setId]
  )

  const grouped = new Map<string, RawActionRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.player_id) ?? []
    list.push(row)
    grouped.set(row.player_id, list)
  }

  return Array.from(grouped.entries()).map(([pid, pRows]) => aggregateRows(pid, pRows))
}

export async function getRotationBreakdown(
  db: D1Database,
  setId: string,
  teamId: string
): Promise<RotationBreakdown[]> {
  const rows = await query<{
    rotation_slot: number
    points_scored: number
    rallies_total: number
    sideout_won: number
    sideout_total: number
    scoring_won: number
    scoring_total: number
  }>(
    db,
    `SELECT rotation_slot, points_scored, rallies_total,
            sideout_won, sideout_total, scoring_won, scoring_total
     FROM rotation_stats
     WHERE set_id = ? AND team_id = ?
     ORDER BY rotation_slot`,
    [setId, teamId]
  )

  return rows.map((r) => ({
    slot: r.rotation_slot,
    sideoutPct: r.sideout_total > 0 ? r.sideout_won / r.sideout_total : 0,
    scoringPct: r.scoring_total > 0 ? r.scoring_won / r.scoring_total : 0,
    pointsScored: r.points_scored,
    ralliesTotal: r.rallies_total,
  }))
}

export async function getAttackHeatMap(
  db: D1Database,
  filters: { teamId?: string; playerId?: string; seasonId?: string; matchId?: string }
): Promise<HeatMapPoint[]> {
  const conditions: string[] = ["ra.action_type = 'attack'", 'ra.dest_x IS NOT NULL']
  const params: (string | null)[] = []

  if (filters.teamId) {
    conditions.push('ra.team_id = ?')
    params.push(filters.teamId)
  }
  if (filters.playerId) {
    conditions.push('ra.player_id = ?')
    params.push(filters.playerId)
  }
  if (filters.seasonId) {
    conditions.push('m.season_id = ?')
    params.push(filters.seasonId)
  }
  if (filters.matchId) {
    conditions.push('s.match_id = ?')
    params.push(filters.matchId)
  }

  const rows = await query<{ dest_x: number; dest_y: number; attack_result: string; player_id: string | null; attack_zone: number | null }>(
    db,
    `SELECT ra.dest_x, ra.dest_y, ra.attack_result, ra.player_id, ra.attack_zone
     FROM rally_actions ra
     JOIN rallies r ON r.id = ra.rally_id
     JOIN sets s ON s.id = r.set_id
     JOIN matches m ON m.id = s.match_id
     WHERE ${conditions.join(' AND ')}`,
    params
  )

  return rows.map((r) => ({
    x: r.dest_x,
    y: r.dest_y,
    result: r.attack_result as HeatMapPoint['result'],
    playerId: r.player_id,
    ...(r.attack_zone !== null ? { zone: r.attack_zone } : {}),
  }))
}

export async function getTeamSideout(
  db: D1Database,
  filters: { teamId: string; seasonId?: string; matchId?: string }
): Promise<{ sideoutWon: number; sideoutTotal: number; sideoutPct: number }> {
  const conditions: string[] = ['rs.team_id = ?']
  const params: string[] = [filters.teamId]

  if (filters.matchId) {
    conditions.push('rs.set_id IN (SELECT id FROM sets WHERE match_id = ?)')
    params.push(filters.matchId)
  } else if (filters.seasonId) {
    conditions.push('rs.set_id IN (SELECT s.id FROM sets s JOIN matches m ON m.id = s.match_id WHERE m.season_id = ?)')
    params.push(filters.seasonId)
  }

  const rows = await query<{ total_won: number | null; total_total: number | null }>(
    db,
    `SELECT SUM(sideout_won) AS total_won, SUM(sideout_total) AS total_total
     FROM rotation_stats rs
     WHERE ${conditions.join(' AND ')}`,
    params
  )

  const row = rows[0]
  const won = row?.total_won ?? 0
  const total = row?.total_total ?? 0
  return { sideoutWon: won, sideoutTotal: total, sideoutPct: total > 0 ? won / total : 0 }
}

export async function getDigHeatMap(
  db: D1Database,
  filters: { teamId?: string; playerId?: string; seasonId?: string; matchId?: string }
): Promise<HeatMapPoint[]> {
  // Include historical 'dig' actions AND new 'pass' actions with pass_context='dig'
  const conditions: string[] = [
    "(ra.action_type = 'dig' OR (ra.action_type = 'pass' AND ra.pass_context = 'dig'))",
    'ra.dig_x IS NOT NULL',
  ]
  const params: (string | null)[] = []

  if (filters.teamId) {
    conditions.push('ra.team_id = ?')
    params.push(filters.teamId)
  }
  if (filters.playerId) {
    conditions.push('ra.player_id = ?')
    params.push(filters.playerId)
  }
  if (filters.seasonId) {
    conditions.push('m.season_id = ?')
    params.push(filters.seasonId)
  }
  if (filters.matchId) {
    conditions.push('s.match_id = ?')
    params.push(filters.matchId)
  }

  const rows = await query<{ dig_x: number; dig_y: number; dig_result: string; player_id: string | null }>(
    db,
    `SELECT ra.dig_x, ra.dig_y, ra.dig_result, ra.player_id
     FROM rally_actions ra
     JOIN rallies r ON r.id = ra.rally_id
     JOIN sets s ON s.id = r.set_id
     JOIN matches m ON m.id = s.match_id
     WHERE ${conditions.join(' AND ')}`,
    params
  )

  return rows.map((r) => ({
    x: r.dig_x,
    y: r.dig_y,
    result: r.dig_result as HeatMapPoint['result'],
    playerId: r.player_id,
  }))
}

export async function getReceptionHeatMap(
  db: D1Database,
  filters: { teamId?: string; playerId?: string; seasonId?: string; matchId?: string }
): Promise<HeatMapPoint[]> {
  const conditions: string[] = ["ra.action_type = 'reception'", 'ra.dig_x IS NOT NULL']
  const params: (string | null)[] = []

  if (filters.teamId) {
    conditions.push('ra.team_id = ?')
    params.push(filters.teamId)
  }
  if (filters.playerId) {
    conditions.push('ra.player_id = ?')
    params.push(filters.playerId)
  }
  if (filters.seasonId) {
    conditions.push('m.season_id = ?')
    params.push(filters.seasonId)
  }
  if (filters.matchId) {
    conditions.push('s.match_id = ?')
    params.push(filters.matchId)
  }

  const rows = await query<{ dig_x: number; dig_y: number; pass_quality: number; player_id: string | null }>(
    db,
    `SELECT ra.dig_x, ra.dig_y, ra.pass_quality, ra.player_id
     FROM rally_actions ra
     JOIN rallies r ON r.id = ra.rally_id
     JOIN sets s ON s.id = r.set_id
     JOIN matches m ON m.id = s.match_id
     WHERE ${conditions.join(' AND ')}`,
    params
  )

  return rows.map((r) => ({
    x: r.dig_x,
    y: r.dig_y,
    // Map reception quality (0–3) to dig result for heatmap coloring:
    // 3=perfect → good_dig (green), 0=aced → no_dig (red), 1–2 → poor_dig (yellow)
    result: (r.pass_quality === 3 ? 'good_dig' : r.pass_quality === 0 ? 'no_dig' : 'poor_dig') as HeatMapPoint['result'],
    playerId: r.player_id,
  }))
}

export async function getServeHeatMap(
  db: D1Database,
  filters: { teamId?: string; playerId?: string; seasonId?: string; matchId?: string }
): Promise<HeatMapPoint[]> {
  const baseJoins = `
    JOIN rallies r ON r.id = ra.rally_id
    JOIN sets s ON s.id = r.set_id
    JOIN matches m ON m.id = s.match_id`

  // ── Query 1: received serves (flip reception dig position) ────────────────
  const cond1: string[] = ["ra.action_type = 'reception'", 'ra.dig_x IS NOT NULL']
  const p1: (string | null)[] = []
  if (filters.teamId)   { cond1.push('r.serving_team_id = ?'); p1.push(filters.teamId) }
  if (filters.playerId) {
    cond1.push("EXISTS (SELECT 1 FROM rally_actions sa WHERE sa.rally_id = ra.rally_id AND sa.action_type = 'serve' AND sa.player_id = ?)")
    p1.push(filters.playerId)
  }
  if (filters.seasonId) { cond1.push('m.season_id = ?'); p1.push(filters.seasonId) }
  if (filters.matchId)  { cond1.push('s.match_id = ?'); p1.push(filters.matchId) }

  const received = await query<{ dig_x: number; dig_y: number; pass_quality: number | null; server_id: string | null }>(
    db,
    `SELECT ra.dig_x, ra.dig_y, ra.pass_quality,
            (SELECT sa.player_id FROM rally_actions sa
             WHERE sa.rally_id = ra.rally_id AND sa.action_type = 'serve' LIMIT 1) AS server_id
     FROM rally_actions ra ${baseJoins}
     WHERE ${cond1.join(' AND ')}`,
    p1
  )

  // ── Query 2: aces with location (serve action with dest_x recorded) ───────
  const cond2: string[] = ["ra.action_type = 'serve'", 'ra.serve_quality = 4', 'ra.dest_x IS NOT NULL']
  const p2: (string | null)[] = []
  if (filters.teamId)   { cond2.push('ra.team_id = ?'); p2.push(filters.teamId) }
  if (filters.playerId) { cond2.push('ra.player_id = ?'); p2.push(filters.playerId) }
  if (filters.seasonId) { cond2.push('m.season_id = ?'); p2.push(filters.seasonId) }
  if (filters.matchId)  { cond2.push('s.match_id = ?'); p2.push(filters.matchId) }

  const aces = await query<{ dest_x: number; dest_y: number; player_id: string | null }>(
    db,
    `SELECT ra.dest_x, ra.dest_y, ra.player_id
     FROM rally_actions ra ${baseJoins}
     WHERE ${cond2.join(' AND ')}`,
    p2
  )

  const fromReceived: HeatMapPoint[] = received.map((r) => {
    const q = r.pass_quality ?? 2
    const result: HeatMapPoint['result'] = q <= 1 ? 'kill' : q === 2 ? 'in_play' : 'error'
    return { x: 1 - r.dig_x, y: 1 - r.dig_y, result, playerId: r.server_id }
  })

  const fromAces: HeatMapPoint[] = aces.map((r) => ({
    x: r.dest_x,
    y: r.dest_y,
    result: 'kill' as HeatMapPoint['result'],
    playerId: r.player_id,
  }))

  return [...fromReceived, ...fromAces]
}

export async function getSeasonLeaderboard(
  db: D1Database,
  seasonId: string
): Promise<PlayerStatsWithTeam[]> {
  const rows = await query<RawActionRow & { player_id: string; team_id: string; team_name: string }>(
    db,
    `SELECT
      ra.player_id,
      p.name AS player_name,
      p.position,
      ra.action_type,
      ra.pass_context,
      ra.serve_quality,
      ra.pass_quality,
      ra.set_type,
      ra.set_quality,
      ra.is_assist,
      ra.attack_result,
      ra.block_result,
      ra.dig_result,
      ra.freeball_result,
      ra.dest_x,
      ra.dest_y,
      ra.dig_x,
      ra.dig_y,
      p.team_id,
      t.name AS team_name
    FROM rally_actions ra
    JOIN players p ON p.id = ra.player_id
    JOIN teams t ON t.id = p.team_id
    JOIN rallies r ON r.id = ra.rally_id
    JOIN sets s ON s.id = r.set_id
    JOIN matches m ON m.id = s.match_id
    WHERE m.season_id = ? AND ra.player_id IS NOT NULL`,
    [seasonId]
  )

  const grouped = new Map<string, (RawActionRow & { team_id: string; team_name: string })[]>()
  for (const row of rows) {
    const list = grouped.get(row.player_id) ?? []
    list.push(row)
    grouped.set(row.player_id, list)
  }

  return Array.from(grouped.entries()).map(([pid, pRows]) => {
    const base = aggregateRows(pid, pRows)
    const first = pRows[0]
    return { ...base, teamId: first.team_id, teamName: first.team_name }
  })
}

export async function getSeasonTeamStats(
  db: D1Database,
  seasonId: string
): Promise<TeamStats[]> {
  const actionRows = await query<{
    team_id: string
    team_name: string
    team_color: string
    attack_attempts: number
    attack_kills: number
    attack_errors: number
    serve_aces: number
    serve_errors: number
    serve_total: number
    serve_quality_sum: number
    pass_total: number
    pass_quality_sum: number
    dig_attempts: number
    solo_blocks: number
    assisted_blocks: number
  }>(
    db,
    `SELECT
      ra.team_id,
      t.name  AS team_name,
      t.color AS team_color,
      SUM(CASE WHEN ra.action_type = 'attack' THEN 1 ELSE 0 END)                                           AS attack_attempts,
      SUM(CASE WHEN ra.action_type = 'attack' AND ra.attack_result = 'kill' THEN 1 ELSE 0 END)             AS attack_kills,
      SUM(CASE WHEN ra.action_type = 'attack' AND ra.attack_result = 'error' THEN 1 ELSE 0 END)            AS attack_errors,
      SUM(CASE WHEN ra.action_type = 'serve'  AND ra.serve_quality = 4 THEN 1 ELSE 0 END)                  AS serve_aces,
      SUM(CASE WHEN ra.action_type = 'serve'  AND ra.serve_quality = 0 THEN 1 ELSE 0 END)                  AS serve_errors,
      SUM(CASE WHEN ra.action_type = 'serve'  THEN 1 ELSE 0 END)                                           AS serve_total,
      SUM(CASE WHEN ra.action_type = 'serve'  THEN COALESCE(ra.serve_quality, 0) ELSE 0 END)               AS serve_quality_sum,
      SUM(CASE WHEN ra.action_type = 'reception' THEN 1 ELSE 0 END)                                        AS pass_total,
      SUM(CASE WHEN ra.action_type = 'reception' THEN COALESCE(ra.pass_quality, 0) ELSE 0 END)             AS pass_quality_sum,
      SUM(CASE WHEN ra.action_type = 'pass' AND ra.pass_context = 'dig' THEN 1 ELSE 0 END)                 AS dig_attempts,
      SUM(CASE WHEN ra.action_type = 'block' AND ra.block_result = 'solo_block' THEN 1 ELSE 0 END)         AS solo_blocks,
      SUM(CASE WHEN ra.action_type = 'block' AND ra.block_result = 'assisted_block' THEN 1 ELSE 0 END)     AS assisted_blocks
    FROM rally_actions ra
    JOIN teams t ON t.id = ra.team_id
    JOIN rallies r ON r.id = ra.rally_id
    JOIN sets s ON s.id = r.set_id
    JOIN matches m ON m.id = s.match_id
    WHERE m.season_id = ?
    GROUP BY ra.team_id`,
    [seasonId]
  )

  const sideoutRows = await query<{ team_id: string; sideout_won: number; sideout_total: number }>(
    db,
    `SELECT rs.team_id,
       SUM(rs.sideout_won)   AS sideout_won,
       SUM(rs.sideout_total) AS sideout_total
     FROM rotation_stats rs
     JOIN sets s ON s.id = rs.set_id
     JOIN matches m ON m.id = s.match_id
     WHERE m.season_id = ?
     GROUP BY rs.team_id`,
    [seasonId]
  )

  const sideoutMap = new Map(sideoutRows.map((r) => [r.team_id, r]))

  return actionRows.map((r) => {
    const so = sideoutMap.get(r.team_id)
    const soWon = so?.sideout_won ?? 0
    const soTotal = so?.sideout_total ?? 0
    return {
      teamId: r.team_id,
      teamName: r.team_name,
      teamColor: r.team_color,
      attackAttempts: r.attack_attempts,
      attackKills: r.attack_kills,
      attackErrors: r.attack_errors,
      attackEfficiency: r.attack_attempts > 0 ? (r.attack_kills - r.attack_errors) / r.attack_attempts : 0,
      serveAces: r.serve_aces,
      serveErrors: r.serve_errors,
      serveTotalAttempts: r.serve_total,
      serveQualityAvg: r.serve_total > 0 ? r.serve_quality_sum / r.serve_total : 0,
      passTotalAttempts: r.pass_total,
      passQualityAvg: r.pass_total > 0 ? r.pass_quality_sum / r.pass_total : 0,
      digAttempts: r.dig_attempts,
      soloBlocks: r.solo_blocks,
      assistedBlocks: r.assisted_blocks,
      sideoutWon: soWon,
      sideoutTotal: soTotal,
      sideoutPct: soTotal > 0 ? soWon / soTotal : 0,
    }
  })
}

export async function getServeQualityDist(
  db: D1Database,
  filters: { teamId?: string; playerId?: string; seasonId?: string; matchId?: string }
): Promise<ServeQualityBucket[]> {
  const conditions: string[] = ["ra.action_type = 'serve'", 'ra.serve_quality IS NOT NULL']
  const params: string[] = []

  if (filters.teamId) {
    conditions.push('ra.team_id = ?')
    params.push(filters.teamId)
  }
  if (filters.playerId) {
    conditions.push('ra.player_id = ?')
    params.push(filters.playerId)
  }
  if (filters.seasonId) {
    conditions.push('m.season_id = ?')
    params.push(filters.seasonId)
  }
  if (filters.matchId) {
    conditions.push('s.match_id = ?')
    params.push(filters.matchId)
  }

  const rows = await query<{ quality: number; count: number }>(
    db,
    `SELECT ra.serve_quality AS quality, COUNT(*) AS count
     FROM rally_actions ra
     JOIN rallies r ON r.id = ra.rally_id
     JOIN sets s ON s.id = r.set_id
     JOIN matches m ON m.id = s.match_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ra.serve_quality
     ORDER BY ra.serve_quality`,
    params
  )

  return rows.map((r) => ({ quality: r.quality, count: r.count }))
}
