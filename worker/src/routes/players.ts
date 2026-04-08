import { Hono } from 'hono'
import type { Env } from '../db/client'
import { newId, query, queryOne, execute } from '../db/client'
import { parseBody, isResponse } from '../middleware/validation'
import { createPlayerSchema } from '@vst/shared'

const players = new Hono<{ Bindings: Env }>()

// GET /teams/:teamId/players
players.get('/teams/:teamId/players', async (c) => {
  const rows = await query(
    c.env.DB,
    'SELECT * FROM players WHERE team_id = ? ORDER BY name',
    [c.req.param('teamId')]
  )
  return c.json(rows)
})

// POST /teams/:teamId/players
players.post('/teams/:teamId/players', async (c) => {
  const { teamId } = c.req.param()
  const team = await queryOne(c.env.DB, 'SELECT id FROM teams WHERE id = ?', [teamId])
  if (!team) return c.json({ error: 'Team not found' }, 404)

  const body = await parseBody(c, createPlayerSchema)
  if (isResponse(body)) return body

  const id = newId()
  const now = Date.now()
  await execute(
    c.env.DB,
    'INSERT INTO players (id, team_id, name, number, position, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    [id, teamId, body.name, body.number ?? null, body.position, now]
  )
  const player = await queryOne(c.env.DB, 'SELECT * FROM players WHERE id = ?', [id])
  return c.json(player, 201)
})

// GET /players/:playerId
players.get('/players/:playerId', async (c) => {
  const player = await queryOne(c.env.DB, 'SELECT * FROM players WHERE id = ?', [c.req.param('playerId')])
  if (!player) return c.json({ error: 'Not found' }, 404)
  return c.json(player)
})

// PUT /players/:playerId
players.put('/players/:playerId', async (c) => {
  const { playerId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM players WHERE id = ?', [playerId])
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const { z } = await import('zod')
  const updateSchema = createPlayerSchema.partial().extend({
    isActive: z.boolean().optional(),
  })
  const body = await parseBody(c, updateSchema)
  if (isResponse(body)) return body

  const fields: string[] = []
  const params: (string | number | boolean | null)[] = []
  if (body.name !== undefined) { fields.push('name = ?'); params.push(body.name) }
  if (body.number !== undefined) { fields.push('number = ?'); params.push(body.number ?? null) }
  if (body.position !== undefined) { fields.push('position = ?'); params.push(body.position) }
  if ((body as { isActive?: boolean }).isActive !== undefined) {
    fields.push('is_active = ?')
    params.push((body as { isActive?: boolean }).isActive ? 1 : 0)
  }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)

  params.push(playerId)
  await execute(c.env.DB, `UPDATE players SET ${fields.join(', ')} WHERE id = ?`, params)
  const player = await queryOne(c.env.DB, 'SELECT * FROM players WHERE id = ?', [playerId])
  return c.json(player)
})

// DELETE /players/:playerId (soft delete — marks inactive)
players.delete('/players/:playerId', async (c) => {
  const { playerId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM players WHERE id = ?', [playerId])
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await execute(c.env.DB, 'UPDATE players SET is_active = 0 WHERE id = ?', [playerId])
  return c.json({ success: true })
})

export default players
