import type { Context, Next } from 'hono'
import type { Env, User } from '../db/client'
import { queryOne } from '../db/client'

type HonoCtx = Context<{ Bindings: Env; Variables: { user: User | null } }>

async function resolveUser(c: HonoCtx): Promise<User | null> {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  if (!token) return null

  const now = Date.now()
  const session = await queryOne<{ user_id: string; expires_at: number }>(
    c.env.DB,
    'SELECT user_id, expires_at FROM sessions WHERE id = ?',
    [token]
  )
  if (!session || session.expires_at < now) return null

  const user = await queryOne<User>(
    c.env.DB,
    'SELECT id, email, role FROM users WHERE id = ?',
    [session.user_id]
  )
  return user
}

/** Attach user to context; return 401 if no valid session. */
export async function requireAuth(c: HonoCtx, next: Next) {
  const user = await resolveUser(c)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  c.set('user', user)
  return next()
}

/** Attach user to context if a valid session exists; never 401s. */
export async function optionalAuth(c: HonoCtx, next: Next) {
  const user = await resolveUser(c)
  c.set('user', user)
  return next()
}
