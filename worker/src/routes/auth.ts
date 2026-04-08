import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../db/client'
import { newId, queryOne, execute } from '../db/client'
import { parseBody, isResponse } from '../middleware/validation'
import { hashPassword, verifyPassword, generateToken } from '../services/crypto'

const auth = new Hono<{ Bindings: Env }>()

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// ─── POST /auth/setup ─────────────────────────────────────────────────────────
// One-time admin account bootstrap. Only works when the users table is empty
// AND the request includes the correct SETUP_SECRET in Authorization header.

auth.post('/setup', async (c) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const secret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!secret || secret !== c.env.SETUP_SECRET) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const existing = await queryOne<{ cnt: number }>(
    c.env.DB, 'SELECT COUNT(*) AS cnt FROM users'
  )
  if ((existing?.cnt ?? 0) > 0) {
    return c.json({ error: 'Setup already complete' }, 403)
  }

  const body = await parseBody(c, setupSchema)
  if (isResponse(body)) return body

  const id = newId()
  const hash = await hashPassword(body.password)
  await execute(
    c.env.DB,
    'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, body.email, hash, 'admin', Date.now()]
  )
  return c.json({ success: true, id })
})

// ─── POST /auth/login ─────────────────────────────────────────────────────────

auth.post('/login', async (c) => {
  const body = await parseBody(c, loginSchema)
  if (isResponse(body)) return body

  const user = await queryOne<{ id: string; email: string; password_hash: string; role: string }>(
    c.env.DB, 'SELECT id, email, password_hash, role FROM users WHERE email = ?', [body.email]
  )
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(body.password, user.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const token = generateToken()
  const now = Date.now()
  await execute(
    c.env.DB,
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [token, user.id, now + SESSION_TTL_MS, now]
  )

  // Purge expired sessions on each login (low frequency, keeps table bounded)
  await execute(c.env.DB, 'DELETE FROM sessions WHERE expires_at < ?', [now])

  return c.json({ token, user: { id: user.id, email: user.email, role: user.role } })
})

// ─── POST /auth/logout ────────────────────────────────────────────────────────

auth.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (token) {
    await execute(c.env.DB, 'DELETE FROM sessions WHERE id = ?', [token])
  }
  return c.json({ success: true })
})

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return c.json({ user: null })

  const now = Date.now()
  const session = await queryOne<{ user_id: string; expires_at: number }>(
    c.env.DB, 'SELECT user_id, expires_at FROM sessions WHERE id = ?', [token]
  )
  if (!session || session.expires_at < now) return c.json({ user: null })

  const user = await queryOne<{ id: string; email: string; role: string }>(
    c.env.DB, 'SELECT id, email, role FROM users WHERE id = ?', [session.user_id]
  )
  return c.json({ user })
})

export default auth
