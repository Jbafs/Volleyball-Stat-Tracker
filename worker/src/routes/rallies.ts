import { Hono } from 'hono'
import type { Env } from '../db/client'
import { newId, query, queryOne, execute } from '../db/client'
import { parseBody, isResponse } from '../middleware/validation'
import { createRallySchema, submitRallySchema } from '@vst/shared'
import type { RallyActionDraft } from '@vst/shared'
import { computeNextRotations } from '../services/rotationService'

const rallies = new Hono<{ Bindings: Env }>()

rallies.get('/sets/:setId/rallies', async (c) => {
  const rows = await query(
    c.env.DB,
    'SELECT * FROM rallies WHERE set_id = ? ORDER BY rally_number',
    [c.req.param('setId')]
  )
  return c.json(rows)
})

// Create a rally shell (without actions — used to get the ID before batch submitting)
rallies.post('/sets/:setId/rallies', async (c) => {
  const { setId } = c.req.param()
  const set = await queryOne(c.env.DB, 'SELECT * FROM sets WHERE id = ?', [setId])
  if (!set) return c.json({ error: 'Set not found' }, 404)

  const body = await parseBody(c, createRallySchema)
  if (isResponse(body)) return body

  // Remove any orphaned shell from a previous session before creating a new one
  await execute(
    c.env.DB,
    'DELETE FROM rallies WHERE set_id = ? AND winning_team_id IS NULL AND point_type IS NULL',
    [setId]
  )

  const count = await queryOne<{ cnt: number }>(
    c.env.DB, 'SELECT COUNT(*) AS cnt FROM rallies WHERE set_id = ?', [setId]
  )
  const rallyNumber = (count?.cnt ?? 0) + 1
  const id = newId()
  const now = Date.now()

  await execute(
    c.env.DB,
    `INSERT INTO rallies
      (id, set_id, rally_number, serving_team_id, home_rotation, away_rotation,
       home_score_before, away_score_before, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, setId, rallyNumber, body.servingTeamId, body.homeRotation, body.awayRotation,
     body.homeScoreBefore, body.awayScoreBefore, now]
  )

  return c.json(await queryOne(c.env.DB, 'SELECT * FROM rallies WHERE id = ?', [id]), 201)
})

// Submit a complete rally: actions + point outcome in one transaction
rallies.post('/rallies/:rallyId/submit', async (c) => {
  const { rallyId } = c.req.param()
  const rally = await queryOne<{
    id: string; set_id: string; serving_team_id: string | null;
    home_rotation: number; away_rotation: number;
    home_score_before: number; away_score_before: number;
  }>(c.env.DB, 'SELECT * FROM rallies WHERE id = ?', [rallyId])
  if (!rally) return c.json({ error: 'Rally not found' }, 404)

  const body = await parseBody(c, submitRallySchema)
  if (isResponse(body)) return body

  const set = await queryOne<{ match_id: string }>(
    c.env.DB, 'SELECT match_id FROM sets WHERE id = ?', [rally.set_id]
  )
  const match = await queryOne<{ home_team_id: string | null; away_team_id: string | null }>(
    c.env.DB, 'SELECT home_team_id, away_team_id FROM matches WHERE id = ?', [set?.match_id ?? '']
  )
  const homeTeamId = match?.home_team_id ?? ''
  const awayTeamId = match?.away_team_id ?? ''

  // Build action inserts, resolving is_assist retroactively in the draft array
  const resolvedActions = resolveAssists(body.actions)

  // Map of sequence → id (needed for linked_action_id on block/dig)
  const actionIds: Record<number, string> = {}
  const now = Date.now()

  const actionStmts = resolvedActions.map((action, idx) => {
    const actionId = newId()
    actionIds[idx] = actionId

    const linkedId = action.linkedActionSequence !== undefined
      ? (actionIds[action.linkedActionSequence] ?? null)
      : null

    return c.env.DB.prepare(
      `INSERT INTO rally_actions
        (id, rally_id, action_sequence, action_type, pass_context, player_id, team_id,
         serve_quality, pass_quality, set_type, set_quality, is_assist,
         is_front_row, attack_zone, dest_x, dest_y, attack_result,
         linked_action_id, block_result, dig_x, dig_y, dig_result,
         freeball_result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      actionId, rallyId, idx + 1, action.actionType, action.passContext ?? null,
      action.playerId ?? null, action.teamId,
      action.serveQuality ?? null,
      action.passQuality ?? null,
      action.setType ?? null, action.setQuality ?? null,
      action.isAssist !== undefined ? (action.isAssist ? 1 : 0) : null,
      action.isFrontRow !== undefined ? (action.isFrontRow ? 1 : 0) : null,
      action.attackZone ?? null,
      action.destX ?? null, action.destY ?? null,
      action.attackResult ?? null,
      linkedId,
      action.blockResult ?? null,
      action.digX ?? null, action.digY ?? null, action.digResult ?? null,
      action.freeballResult ?? null,
      now
    )
  })

  // Compute next rotations
  const { nextHomeRotation, nextAwayRotation, nextServingTeamId } = computeNextRotations(
    rally.serving_team_id,
    body.winningTeamId,
    homeTeamId,
    rally.home_rotation,
    rally.away_rotation
  )

  // New scores
  const homeWon = body.winningTeamId === homeTeamId
  const newHomeScore = rally.home_score_before + (homeWon ? 1 : 0)
  const newAwayScore = rally.away_score_before + (homeWon ? 0 : 1)

  // Update rally with outcome
  const updateRallyStmt = c.env.DB.prepare(
    'UPDATE rallies SET winning_team_id = ?, point_type = ? WHERE id = ?'
  ).bind(body.winningTeamId, body.pointType, rallyId)

  // Update set scores
  const updateSetStmt = c.env.DB.prepare(
    'UPDATE sets SET home_score = ?, away_score = ? WHERE id = ?'
  ).bind(newHomeScore, newAwayScore, rally.set_id)

  const rotationStmts = buildRotationStatsStatements(c.env.DB, rally, body.winningTeamId, homeTeamId, awayTeamId, now)
  await c.env.DB.batch([...actionStmts, updateRallyStmt, updateSetStmt, ...rotationStmts])

  return c.json({
    rallyId,
    nextHomeRotation,
    nextAwayRotation,
    nextServingTeamId,
    homeScore: newHomeScore,
    awayScore: newAwayScore,
  })
})

rallies.get('/rallies/:rallyId', async (c) => {
  const rally = await queryOne(c.env.DB, 'SELECT * FROM rallies WHERE id = ?', [c.req.param('rallyId')])
  if (!rally) return c.json({ error: 'Not found' }, 404)
  return c.json(rally)
})

rallies.get('/rallies/:rallyId/actions', async (c) => {
  const actions = await query(
    c.env.DB,
    'SELECT * FROM rally_actions WHERE rally_id = ? ORDER BY action_sequence',
    [c.req.param('rallyId')]
  )
  return c.json(actions)
})

rallies.delete('/rallies/:rallyId', async (c) => {
  const { rallyId } = c.req.param()
  const rally = await queryOne<{
    set_id: string; home_score_before: number; away_score_before: number;
    serving_team_id: string | null; home_rotation: number; away_rotation: number;
    winning_team_id: string | null;
  }>(
    c.env.DB,
    'SELECT set_id, home_score_before, away_score_before, serving_team_id, home_rotation, away_rotation, winning_team_id FROM rallies WHERE id = ?',
    [rallyId]
  )
  if (!rally) return c.json({ error: 'Not found' }, 404)

  const stmts: ReturnType<D1Database['prepare']>[] = [
    c.env.DB.prepare('DELETE FROM rallies WHERE id = ?').bind(rallyId),
    c.env.DB.prepare('UPDATE sets SET home_score = ?, away_score = ? WHERE id = ?')
      .bind(rally.home_score_before, rally.away_score_before, rally.set_id),
  ]

  // If this rally was submitted, reverse its rotation_stats contribution
  if (rally.winning_team_id) {
    const rallySet = await queryOne<{ match_id: string }>(
      c.env.DB, 'SELECT match_id FROM sets WHERE id = ?', [rally.set_id]
    )
    const rallyMatch = await queryOne<{ home_team_id: string | null; away_team_id: string | null }>(
      c.env.DB, 'SELECT home_team_id, away_team_id FROM matches WHERE id = ?', [rallySet?.match_id ?? '']
    )
    const homeTeamId = rallyMatch?.home_team_id ?? ''
    const awayTeamId = rallyMatch?.away_team_id ?? ''
    const homeWon = rally.winning_team_id === homeTeamId
    const homeIsServing = rally.serving_team_id === homeTeamId

    for (const isHome of [true, false]) {
      const teamId = isHome ? homeTeamId : awayTeamId
      if (!teamId) continue
      const rotation = isHome ? rally.home_rotation : rally.away_rotation
      const teamWon = isHome ? homeWon : !homeWon
      const teamIsServing = isHome ? homeIsServing : !homeIsServing
      const isSideout = !teamIsServing && teamWon
      const isScoring = teamIsServing

      stmts.push(
        c.env.DB.prepare(`
          UPDATE rotation_stats SET
            points_scored = points_scored - ?,
            rallies_total = rallies_total - 1,
            sideout_won   = sideout_won   - ?,
            sideout_total = sideout_total - ?,
            scoring_won   = scoring_won   - ?,
            scoring_total = scoring_total - ?
          WHERE set_id = ? AND team_id = ? AND rotation_slot = ?
        `).bind(
          teamWon ? 1 : 0,
          isSideout && teamWon ? 1 : 0,
          isSideout ? 1 : 0,
          isScoring && teamWon ? 1 : 0,
          isScoring ? 1 : 0,
          rally.set_id, teamId, rotation
        )
      )
    }
  }

  await c.env.DB.batch(stmts)
  return c.json({ success: true })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveAssists(actions: RallyActionDraft[]): (RallyActionDraft & { isAssist?: boolean })[] {
  const resolved = actions.map((a) => ({ ...a, isAssist: undefined as boolean | undefined }))
  for (let i = 0; i < resolved.length; i++) {
    const action = resolved[i]
    if (action.actionType === 'attack' && action.attackResult === 'kill') {
      // Find the preceding set action
      for (let j = i - 1; j >= 0; j--) {
        if (resolved[j].actionType === 'set') {
          resolved[j].isAssist = true
          break
        }
      }
    }
  }
  return resolved
}

function buildRotationStatsStatements(
  db: D1Database,
  rally: { set_id: string; serving_team_id: string | null; home_rotation: number; away_rotation: number },
  winningTeamId: string | null,
  homeTeamId: string,
  awayTeamId: string,
  now: number
): ReturnType<D1Database['prepare']>[] {
  const homeIsServing = rally.serving_team_id === homeTeamId
  const homeWon = winningTeamId === homeTeamId
  const stmts: ReturnType<D1Database['prepare']>[] = []

  for (const isHome of [true, false]) {
    const teamId = isHome ? homeTeamId : awayTeamId
    if (!teamId) continue
    const rotation = isHome ? rally.home_rotation : rally.away_rotation
    const teamWon = isHome ? homeWon : !homeWon
    const teamIsServing = isHome ? homeIsServing : !homeIsServing
    const isSideout = !teamIsServing && teamWon
    const isScoring = teamIsServing

    stmts.push(
      db.prepare(`
        INSERT INTO rotation_stats
          (id, set_id, team_id, rotation_slot, points_scored, rallies_total,
           sideout_won, sideout_total, scoring_won, scoring_total, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ON CONFLICT(set_id, team_id, rotation_slot) DO UPDATE SET
          points_scored = points_scored + ?,
          rallies_total = rallies_total + 1,
          sideout_won = sideout_won + ?,
          sideout_total = sideout_total + ?,
          scoring_won = scoring_won + ?,
          scoring_total = scoring_total + ?,
          updated_at = ?
      `).bind(
        newId(), rally.set_id, teamId, rotation,
        teamWon ? 1 : 0,
        isSideout && teamWon ? 1 : 0,
        isSideout ? 1 : 0,
        isScoring && teamWon ? 1 : 0,
        isScoring ? 1 : 0,
        now,
        // ON CONFLICT updates:
        teamWon ? 1 : 0,
        isSideout && teamWon ? 1 : 0,
        isSideout ? 1 : 0,
        isScoring && teamWon ? 1 : 0,
        isScoring ? 1 : 0,
        now
      )
    )
  }

  return stmts
}

export default rallies
