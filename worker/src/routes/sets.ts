import { Hono } from 'hono'
import type { Env } from '../db/client'
import { newId, query, queryOne, execute } from '../db/client'
import { parseBody, isResponse } from '../middleware/validation'
import { createSetSchema, updateSetSchema, upsertLineupSchema, createSubstitutionSchema } from '@vst/shared'

const sets = new Hono<{ Bindings: Env }>()

sets.get('/matches/:matchId/sets', async (c) => {
  const rows = await query(
    c.env.DB,
    'SELECT * FROM sets WHERE match_id = ? ORDER BY set_number',
    [c.req.param('matchId')]
  )
  return c.json(rows)
})

sets.post('/matches/:matchId/sets', async (c) => {
  const { matchId } = c.req.param()
  const match = await queryOne(c.env.DB, 'SELECT id FROM matches WHERE id = ?', [matchId])
  if (!match) return c.json({ error: 'Match not found' }, 404)

  const body = await parseBody(c, createSetSchema)
  if (isResponse(body)) return body

  const id = newId()
  const now = Date.now()
  await execute(
    c.env.DB,
    `INSERT INTO sets
      (id, match_id, set_number, home_score, away_score,
       home_starting_rotation, away_starting_rotation, first_serving_team_id, status, created_at)
     VALUES (?, ?, ?, 0, 0, ?, ?, ?, 'planned', ?)`,
    [id, matchId, body.setNumber,
     body.homeStartingRotation ?? null,
     body.awayStartingRotation ?? null,
     body.firstServingTeamId ?? null,
     now]
  )
  const set = await queryOne(c.env.DB, 'SELECT * FROM sets WHERE id = ?', [id])
  return c.json(set, 201)
})

sets.get('/sets/:setId', async (c) => {
  const set = await queryOne(c.env.DB, 'SELECT * FROM sets WHERE id = ?', [c.req.param('setId')])
  if (!set) return c.json({ error: 'Not found' }, 404)
  return c.json(set)
})

sets.put('/sets/:setId', async (c) => {
  const { setId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM sets WHERE id = ?', [setId])
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await parseBody(c, updateSetSchema)
  if (isResponse(body)) return body

  const fields: string[] = []
  const params: (string | number | null)[] = []

  if ('homeScore' in body && body.homeScore !== undefined) { fields.push('home_score = ?'); params.push(body.homeScore as number) }
  if ('awayScore' in body && body.awayScore !== undefined) { fields.push('away_score = ?'); params.push(body.awayScore as number) }
  if (body.homeStartingRotation !== undefined) { fields.push('home_starting_rotation = ?'); params.push(body.homeStartingRotation ?? null) }
  if (body.awayStartingRotation !== undefined) { fields.push('away_starting_rotation = ?'); params.push(body.awayStartingRotation ?? null) }
  if (body.firstServingTeamId !== undefined) { fields.push('first_serving_team_id = ?'); params.push(body.firstServingTeamId ?? null) }
  if ('status' in body) { fields.push('status = ?'); params.push(body.status as string) }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
  params.push(setId)
  await execute(c.env.DB, `UPDATE sets SET ${fields.join(', ')} WHERE id = ?`, params)
  return c.json(await queryOne(c.env.DB, 'SELECT * FROM sets WHERE id = ?', [setId]))
})

// Upsert lineup slots for one team in a set
sets.post('/sets/:setId/lineup', async (c) => {
  const { setId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM sets WHERE id = ?', [setId])
  if (!existing) return c.json({ error: 'Set not found' }, 404)

  const body = await parseBody(c, upsertLineupSchema)
  if (isResponse(body)) return body

  // Validate that all provided players belong to the specified team
  const playerIds = body.slots.map((s) => s.playerId).filter(Boolean) as string[]
  if (playerIds.length > 0) {
    const placeholders = playerIds.map(() => '?').join(', ')
    const validPlayers = await query(
      c.env.DB,
      `SELECT id FROM players WHERE id IN (${placeholders}) AND team_id = ?`,
      [...playerIds, body.teamId]
    )
    if (validPlayers.length !== playerIds.length)
      return c.json({ error: 'One or more players do not belong to this team' }, 400)
  }

  const now = Date.now()
  const stmts: ReturnType<D1Database['prepare']>[] = []

  for (const slot of body.slots) {
    const id = newId()
    stmts.push(
      c.env.DB.prepare(
        `INSERT INTO set_lineups (id, set_id, team_id, player_id, rotation_slot, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(set_id, team_id, rotation_slot) DO UPDATE SET player_id = excluded.player_id`
      ).bind(id, setId, body.teamId, slot.playerId, slot.rotationSlot, now)
    )
  }

  await c.env.DB.batch(stmts)
  const lineup = await query(
    c.env.DB,
    'SELECT sl.*, p.name, p.number, p.position FROM set_lineups sl JOIN players p ON p.id = sl.player_id WHERE sl.set_id = ? AND sl.team_id = ? ORDER BY rotation_slot',
    [setId, body.teamId]
  )
  return c.json(lineup)
})

sets.get('/sets/:setId/lineup', async (c) => {
  const { setId } = c.req.param()
  const { teamId } = c.req.query()
  const params: string[] = [setId]
  let sql = 'SELECT sl.*, p.name, p.number, p.position FROM set_lineups sl JOIN players p ON p.id = sl.player_id WHERE sl.set_id = ?'
  if (teamId) { sql += ' AND sl.team_id = ?'; params.push(teamId) }
  sql += ' ORDER BY sl.team_id, sl.rotation_slot'
  const lineup = await query(c.env.DB, sql, params)
  return c.json(lineup)
})

sets.post('/sets/:setId/substitutions', async (c) => {
  const { setId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM sets WHERE id = ?', [setId])
  if (!existing) return c.json({ error: 'Set not found' }, 404)

  const body = await parseBody(c, createSubstitutionSchema)
  if (isResponse(body)) return body

  const [playerOut, playerIn] = await Promise.all([
    queryOne(c.env.DB, 'SELECT team_id FROM players WHERE id = ?', [body.playerOutId]),
    queryOne(c.env.DB, 'SELECT team_id FROM players WHERE id = ?', [body.playerInId]),
  ])
  const playerOutRow = playerOut as unknown as Record<string, unknown>
  const playerInRow = playerIn as unknown as Record<string, unknown>
  if (playerOutRow?.team_id !== body.teamId || playerInRow?.team_id !== body.teamId) {
    return c.json({ error: 'Both players must belong to the specified team' }, 400)
  }

  const id = newId()
  const now = Date.now()
  await execute(
    c.env.DB,
    `INSERT INTO substitutions
      (id, set_id, team_id, player_out_id, player_in_id, rotation_slot, rally_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, setId, body.teamId, body.playerOutId, body.playerInId, body.rotationSlot, body.rallyNumber ?? null, now]
  )
  const sub = await queryOne(c.env.DB, 'SELECT * FROM substitutions WHERE id = ?', [id])
  return c.json(sub, 201)
})

sets.get('/sets/:setId/substitutions', async (c) => {
  const { setId } = c.req.param()
  const rows = await query(
    c.env.DB,
    'SELECT * FROM substitutions WHERE set_id = ? ORDER BY created_at',
    [setId]
  )
  return c.json(rows)
})

export default sets
