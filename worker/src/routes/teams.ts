import { Hono } from 'hono'
import type { Env } from '../db/client'
import { newId, query, queryOne, execute } from '../db/client'
import { parseBody, isResponse } from '../middleware/validation'
import { createTeamSchema, updateTeamDefaultLineupSchema } from '@vst/shared'

const teams = new Hono<{ Bindings: Env }>()

teams.get('/', async (c) => {
  const rows = await query(c.env.DB, 'SELECT * FROM teams ORDER BY name')
  return c.json(rows)
})

teams.post('/', async (c) => {
  const body = await parseBody(c, createTeamSchema)
  if (isResponse(body)) return body

  const id = newId()
  const now = Date.now()
  await execute(
    c.env.DB,
    'INSERT INTO teams (id, name, short_name, color, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, body.name, body.shortName, body.color ?? '#3B82F6', now]
  )
  const team = await queryOne(c.env.DB, 'SELECT * FROM teams WHERE id = ?', [id])
  return c.json(team, 201)
})

teams.get('/:teamId', async (c) => {
  const team = await queryOne(c.env.DB, 'SELECT * FROM teams WHERE id = ?', [c.req.param('teamId')])
  if (!team) return c.json({ error: 'Not found' }, 404)
  return c.json(team)
})

teams.put('/:teamId', async (c) => {
  const body = await parseBody(c, createTeamSchema.partial())
  if (isResponse(body)) return body

  const { teamId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM teams WHERE id = ?', [teamId])
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const fields: string[] = []
  const params: (string | number | null)[] = []
  if (body.name !== undefined) { fields.push('name = ?'); params.push(body.name) }
  if (body.shortName !== undefined) { fields.push('short_name = ?'); params.push(body.shortName) }
  if (body.color !== undefined) { fields.push('color = ?'); params.push(body.color) }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)

  params.push(teamId)
  await execute(c.env.DB, `UPDATE teams SET ${fields.join(', ')} WHERE id = ?`, params)
  const team = await queryOne(c.env.DB, 'SELECT * FROM teams WHERE id = ?', [teamId])
  return c.json(team)
})

teams.patch('/:teamId/default-lineup', async (c) => {
  const { teamId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM teams WHERE id = ?', [teamId])
  if (!existing) return c.json({ error: 'Not found' }, 404)
  const body = await parseBody(c, updateTeamDefaultLineupSchema)
  if (isResponse(body)) return body
  await execute(
    c.env.DB,
    'UPDATE teams SET default_lineup = ?, default_starting_rotation = ? WHERE id = ?',
    [JSON.stringify(body.defaultLineup), body.defaultStartingRotation ?? null, teamId]
  )
  return c.json(await queryOne(c.env.DB, 'SELECT * FROM teams WHERE id = ?', [teamId]))
})

teams.delete('/:teamId', async (c) => {
  const { teamId } = c.req.param()
  const existing = await queryOne(c.env.DB, 'SELECT id FROM teams WHERE id = ?', [teamId])
  if (!existing) return c.json({ error: 'Not found' }, 404)
  await execute(c.env.DB, 'DELETE FROM teams WHERE id = ?', [teamId])
  return c.json({ success: true })
})

export default teams
