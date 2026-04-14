import { Hono } from 'hono'
import type { Env } from '../db/client'
import { newId, query, queryOne, execute } from '../db/client'
import { parseBody, isResponse } from '../middleware/validation'
import { createSeasonSchema } from '@vst/shared'

const seasons = new Hono<{ Bindings: Env }>()

// ─── Global season list ───────────────────────────────────────────────────────

seasons.get('/seasons', async (c) => {
  const rows = await query(
    c.env.DB,
    `SELECT s.*,
       (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS match_count
     FROM seasons s
     ORDER BY s.start_date DESC, s.created_at DESC`
  )
  return c.json(rows)
})

seasons.post('/seasons', async (c) => {
  const body = await parseBody(c, createSeasonSchema)
  if (isResponse(body)) return body

  const id = newId()
  const now = Date.now()
  await execute(
    c.env.DB,
    'INSERT INTO seasons (id, name, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, body.name, body.startDate ?? null, body.endDate ?? null, now]
  )
  const season = await queryOne(c.env.DB, 'SELECT * FROM seasons WHERE id = ?', [id])
  return c.json(season, 201)
})

// ─── Team-scoped season list (derived via matches) ────────────────────────────

seasons.get('/teams/:teamId/seasons', async (c) => {
  const { teamId } = c.req.param()
  // Return distinct seasons that this team has played in (via matches),
  // ordered newest first by start_date.
  const rows = await query(
    c.env.DB,
    `SELECT DISTINCT s.*
     FROM seasons s
     JOIN matches m ON m.season_id = s.id
     WHERE m.home_team_id = ? OR m.away_team_id = ?
     ORDER BY s.start_date DESC, s.created_at DESC`,
    [teamId, teamId]
  )
  return c.json(rows)
})

// ─── Single season ────────────────────────────────────────────────────────────

seasons.get('/seasons/:seasonId', async (c) => {
  const season = await queryOne(c.env.DB, 'SELECT * FROM seasons WHERE id = ?', [c.req.param('seasonId')])
  if (!season) return c.json({ error: 'Not found' }, 404)
  return c.json(season)
})

seasons.put('/seasons/:seasonId', async (c) => {
  const { seasonId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM seasons WHERE id = ?', [seasonId])
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await parseBody(c, createSeasonSchema.partial())
  if (isResponse(body)) return body

  const fields: string[] = []
  const params: (string | null)[] = []
  if (body.name !== undefined) { fields.push('name = ?'); params.push(body.name) }
  if (body.startDate !== undefined) { fields.push('start_date = ?'); params.push(body.startDate ?? null) }
  if (body.endDate !== undefined) { fields.push('end_date = ?'); params.push(body.endDate ?? null) }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)

  params.push(seasonId)
  await execute(c.env.DB, `UPDATE seasons SET ${fields.join(', ')} WHERE id = ?`, params)
  const season = await queryOne(c.env.DB, 'SELECT * FROM seasons WHERE id = ?', [seasonId])
  return c.json(season)
})

seasons.delete('/seasons/:seasonId', async (c) => {
  const { seasonId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM seasons WHERE id = ?', [seasonId])
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await execute(c.env.DB, 'DELETE FROM seasons WHERE id = ?', [seasonId])
  return c.json({ success: true })
})

export default seasons
