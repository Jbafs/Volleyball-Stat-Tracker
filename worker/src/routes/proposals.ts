import { Hono } from 'hono'
import type { Env, User } from '../db/client'
import { newId, query, queryOne, execute } from '../db/client'
import { parseBody, isResponse } from '../middleware/validation'
import { createProposalSchema, reviewProposalSchema } from '@vst/shared'

const proposals = new Hono<{ Bindings: Env; Variables: { user: User | null } }>()

// Manual-review entity types — cannot be auto-applied
const MANUAL_TYPES = new Set(['score_correction', 'suggestion'])

// ─── POST /proposals — public ─────────────────────────────────────────────────

proposals.post('/', async (c) => {
  const body = await parseBody(c, createProposalSchema)
  if (isResponse(body)) return body

  const isManual = MANUAL_TYPES.has(body.entityType) || body.actionType === 'delete'
  const id = newId()
  await execute(
    c.env.DB,
    `INSERT INTO proposals
      (id, proposer_name, proposer_email, entity_type, action_type, entity_id,
       payload, manual_review, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      id,
      body.proposerName,
      body.proposerEmail ?? null,
      body.entityType,
      body.actionType,
      body.entityId ?? null,
      typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload),
      isManual ? 1 : 0,
      Date.now(),
    ]
  )
  return c.json({ id }, 201)
})

// ─── GET /proposals — admin only ──────────────────────────────────────────────

proposals.get('/', async (c) => {
  const status = c.req.query('status') ?? 'pending'
  const rows = await query(
    c.env.DB,
    `SELECT p.*, u.email AS reviewed_by_email
     FROM proposals p
     LEFT JOIN users u ON u.id = p.reviewed_by
     WHERE p.status = ?
     ORDER BY p.created_at DESC`,
    [status]
  )
  return c.json(rows)
})

proposals.get('/count', async (c) => {
  const row = await queryOne<{ cnt: number }>(
    c.env.DB,
    "SELECT COUNT(*) AS cnt FROM proposals WHERE status = 'pending'"
  )
  return c.json({ pending: row?.cnt ?? 0 })
})

proposals.get('/:id', async (c) => {
  const row = await queryOne(
    c.env.DB,
    `SELECT p.*, u.email AS reviewed_by_email
     FROM proposals p
     LEFT JOIN users u ON u.id = p.reviewed_by
     WHERE p.id = ?`,
    [c.req.param('id')]
  )
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

// ─── PATCH /proposals/:id — admin only ───────────────────────────────────────

proposals.patch('/:id', async (c) => {
  const { id } = c.req.param()
  const proposal = await queryOne<{
    id: string; entity_type: string; action_type: string; entity_id: string | null;
    payload: string; manual_review: number; status: string;
  }>(c.env.DB, 'SELECT * FROM proposals WHERE id = ?', [id])
  if (!proposal) return c.json({ error: 'Not found' }, 404)
  if (proposal.status !== 'pending') return c.json({ error: 'Proposal already reviewed' }, 409)

  const body = await parseBody(c, reviewProposalSchema)
  if (isResponse(body)) return body

  const user = c.get('user')
  const now = Date.now()

  if (body.status === 'rejected') {
    await execute(
      c.env.DB,
      'UPDATE proposals SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
      ['rejected', body.rejectReason ?? null, user?.id ?? null, now, id]
    )
    return c.json({ success: true })
  }

  // 'applied' → admin did it manually
  if (body.status === 'applied') {
    await execute(
      c.env.DB,
      'UPDATE proposals SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
      ['applied', user?.id ?? null, now, id]
    )
    return c.json({ success: true })
  }

  // 'approved' → attempt auto-apply for non-manual proposals
  if (proposal.manual_review === 1) {
    return c.json({ error: 'This proposal requires manual review — use status: "applied" after you have made the change' }, 400)
  }

  try {
    await autoApply(c.env.DB, proposal)
  } catch (err) {
    console.error('Auto-apply failed', err)
    return c.json({ error: 'Failed to apply proposal' }, 500)
  }

  await execute(
    c.env.DB,
    'UPDATE proposals SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
    ['approved', user?.id ?? null, now, id]
  )
  return c.json({ success: true })
})

// ─── Auto-apply logic ─────────────────────────────────────────────────────────

async function autoApply(
  db: D1Database,
  proposal: { entity_type: string; action_type: string; entity_id: string | null; payload: string }
) {
  const data = JSON.parse(proposal.payload) as Record<string, unknown>

  if (proposal.entity_type === 'team') {
    if (proposal.action_type === 'create') {
      const id = newId()
      await execute(db,
        'INSERT INTO teams (id, name, short_name, color, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, data.name as string, data.shortName as string, (data.color as string) ?? '#3B82F6', Date.now()]
      )
    } else if (proposal.action_type === 'update' && proposal.entity_id) {
      const fields: string[] = []
      const params: (string | number | null)[] = []
      if (data.name)      { fields.push('name = ?');       params.push(data.name as string) }
      if (data.shortName) { fields.push('short_name = ?'); params.push(data.shortName as string) }
      if (data.color)     { fields.push('color = ?');      params.push(data.color as string) }
      if (fields.length > 0) {
        params.push(proposal.entity_id)
        await execute(db, `UPDATE teams SET ${fields.join(', ')} WHERE id = ?`, params)
      }
    }
    return
  }

  if (proposal.entity_type === 'player') {
    if (proposal.action_type === 'create') {
      const id = newId()
      await execute(db,
        'INSERT INTO players (id, team_id, name, number, position, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
        [id, data.teamId as string, data.name as string, (data.number as number | null) ?? null, data.position as string, Date.now()]
      )
    } else if (proposal.action_type === 'update' && proposal.entity_id) {
      const fields: string[] = []
      const params: (string | number | null)[] = []
      if (data.name !== undefined)     { fields.push('name = ?');     params.push(data.name as string) }
      if (data.number !== undefined)   { fields.push('number = ?');   params.push((data.number as number | null) ?? null) }
      if (data.position !== undefined) { fields.push('position = ?'); params.push(data.position as string) }
      if (fields.length > 0) {
        params.push(proposal.entity_id)
        await execute(db, `UPDATE players SET ${fields.join(', ')} WHERE id = ?`, params)
      }
    } else if (proposal.action_type === 'delete' && proposal.entity_id) {
      // Soft delete
      await execute(db, 'UPDATE players SET is_active = 0 WHERE id = ?', [proposal.entity_id])
    }
    return
  }

  if (proposal.entity_type === 'match' && proposal.action_type === 'update' && proposal.entity_id) {
    const fields: string[] = []
    const params: (string | number | null)[] = []
    if (data.matchDate !== undefined) { fields.push('match_date = ?');  params.push(data.matchDate as string) }
    if (data.location !== undefined)  { fields.push('location = ?');    params.push((data.location as string | null) ?? null) }
    if (data.notes !== undefined)     { fields.push('notes = ?');       params.push((data.notes as string | null) ?? null) }
    if (data.format !== undefined)    { fields.push('format = ?');      params.push(data.format as string) }
    if (data.seasonId !== undefined)  { fields.push('season_id = ?');   params.push((data.seasonId as string | null) ?? null) }
    if (fields.length > 0) {
      params.push(proposal.entity_id)
      await execute(db, `UPDATE matches SET ${fields.join(', ')} WHERE id = ?`, params)
    }
    return
  }

  throw new Error(`Unsupported auto-apply: ${proposal.entity_type}/${proposal.action_type}`)
}

export default proposals
