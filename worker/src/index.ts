import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env, User } from './db/client'
import { requireAuth } from './middleware/auth'
import teams from './routes/teams'
import players from './routes/players'
import seasons from './routes/seasons'
import matches from './routes/matches'
import sets from './routes/sets'
import rallies from './routes/rallies'
import stats from './routes/stats'
import auth from './routes/auth'
import proposals from './routes/proposals'

type AppEnv = { Bindings: Env; Variables: { user: User | null } }

const app = new Hono<AppEnv>()

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://volleyball-stat-tracker.pages.dev', 'https://volleyball-stat-tracker-production.juliusbscales.workers.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

const api = app.basePath('/api/v1')

// ─── Auth routes (always public) ─────────────────────────────────────────────
api.route('/auth', auth)

// ─── Write-guard middleware ───────────────────────────────────────────────────
// OPTIONS always public. GET is public except /proposals (admin-only data).
// POST /proposals is public (anyone can submit a proposal without login).
// Everything else requires an admin session.
api.use('*', async (c, next) => {
  const method = c.req.method
  if (method === 'OPTIONS') return next()

  const path = new URL(c.req.url).pathname
  // All GETs are public except proposal endpoints (contain proposer PII)
  if (method === 'GET' && !path.startsWith('/api/v1/proposals')) return next()
  // Public proposal submission
  if (path === '/api/v1/proposals' && method === 'POST') return next()

  return requireAuth(c as Parameters<typeof requireAuth>[0], next)
})

// ─── Resource routes ──────────────────────────────────────────────────────────
api.route('/teams', teams)
api.route('/', players)
api.route('/', seasons)
api.route('/matches', matches)
api.route('/', sets)
api.route('/', rallies)
api.route('/stats', stats)
api.route('/proposals', proposals)

api.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not found' }, 404)
  }
  // For client-side routes (e.g. /teams/:id), serve index.html via the
  // ASSETS binding so the SPA handles routing in the browser.
  return c.env.ASSETS.fetch(c.req.raw)
})
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
