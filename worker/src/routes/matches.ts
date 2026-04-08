import { Hono } from 'hono'
import type { Env } from '../db/client'
import { newId, query, queryOne, execute } from '../db/client'
import { parseBody, isResponse } from '../middleware/validation'
import { createMatchSchema, updateMatchSchema } from '@vst/shared'

const matches = new Hono<{ Bindings: Env }>()

matches.get('/', async (c) => {
  const { seasonId, teamId, status, limit: limitStr, offset: offsetStr } = c.req.query()
  const limit = Math.min(parseInt(limitStr ?? '50', 10) || 50, 200)
  const offset = parseInt(offsetStr ?? '0', 10) || 0

  const conditions: string[] = []
  const params: (string | number | null)[] = []

  if (seasonId) { conditions.push('m.season_id = ?'); params.push(seasonId) }
  if (teamId) {
    conditions.push('(m.home_team_id = ? OR m.away_team_id = ?)')
    params.push(teamId, teamId)
  }
  if (status) { conditions.push('m.status = ?'); params.push(status) }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await query(
    c.env.DB,
    `SELECT m.*,
       ht.name AS home_team_name, ht.short_name AS home_team_short_name, ht.color AS home_team_color,
       at.name AS away_team_name, at.short_name AS away_team_short_name, at.color AS away_team_color,
       (SELECT COUNT(*) FROM sets WHERE match_id = m.id AND home_score > away_score) AS home_sets_won,
       (SELECT COUNT(*) FROM sets WHERE match_id = m.id AND away_score > home_score) AS away_sets_won
     FROM matches m
     LEFT JOIN teams ht ON ht.id = m.home_team_id
     LEFT JOIN teams at ON at.id = m.away_team_id
     ${where}
     ORDER BY m.match_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
  return c.json(rows)
})

matches.post('/', async (c) => {
  const body = await parseBody(c, createMatchSchema)
  if (isResponse(body)) return body

  const id = newId()
  const now = Date.now()
  await execute(
    c.env.DB,
    `INSERT INTO matches
      (id, home_team_id, away_team_id, opponent_name, season_id, match_date, location, notes, format, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?)`,
    [id, body.homeTeamId ?? null, body.awayTeamId ?? null, body.opponentName ?? null,
     body.seasonId ?? null, body.matchDate, body.location ?? null, body.notes ?? null,
     body.format ?? 'bo3', now]
  )
  const match = await queryOne(c.env.DB, 'SELECT * FROM matches WHERE id = ?', [id])
  return c.json(match, 201)
})

matches.get('/:matchId', async (c) => {
  const match = await queryOne(
    c.env.DB,
    `SELECT m.*,
       ht.name AS home_team_name, ht.short_name AS home_team_short_name, ht.color AS home_team_color,
       at.name AS away_team_name, at.short_name AS away_team_short_name, at.color AS away_team_color
     FROM matches m
     LEFT JOIN teams ht ON ht.id = m.home_team_id
     LEFT JOIN teams at ON at.id = m.away_team_id
     WHERE m.id = ?`,
    [c.req.param('matchId')]
  )
  if (!match) return c.json({ error: 'Not found' }, 404)
  return c.json(match)
})

matches.put('/:matchId', async (c) => {
  const { matchId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM matches WHERE id = ?', [matchId])
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await parseBody(c, updateMatchSchema)
  if (isResponse(body)) return body

  const fields: string[] = []
  const params: (string | null)[] = []
  if (body.matchDate !== undefined) { fields.push('match_date = ?'); params.push(body.matchDate) }
  if (body.location !== undefined) { fields.push('location = ?'); params.push(body.location ?? null) }
  if (body.notes !== undefined) { fields.push('notes = ?'); params.push(body.notes ?? null) }
  if (body.seasonId !== undefined) { fields.push('season_id = ?'); params.push(body.seasonId ?? null) }
  if (body.format !== undefined) { fields.push('format = ?'); params.push(body.format) }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)

  params.push(matchId)
  await execute(c.env.DB, `UPDATE matches SET ${fields.join(', ')} WHERE id = ?`, params)
  return c.json(await queryOne(c.env.DB, 'SELECT * FROM matches WHERE id = ?', [matchId]))
})

matches.patch('/:matchId/status', async (c) => {
  const { matchId } = c.req.param()
  const { status } = await c.req.json<{ status: string }>()
  if (!['planned', 'in_progress', 'complete'].includes(status))
    return c.json({ error: 'Invalid status' }, 400)
  await execute(c.env.DB, 'UPDATE matches SET status = ? WHERE id = ?', [status, matchId])
  return c.json({ success: true })
})

matches.delete('/:matchId', async (c) => {
  const { matchId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM matches WHERE id = ?', [matchId])
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await execute(c.env.DB, 'DELETE FROM matches WHERE id = ?', [matchId])
  return c.json({ success: true })
})

export default matches
