import { Hono } from 'hono'
import type { Env } from '../db/client'
import { getPlayerStats, getRotationBreakdown, getAttackHeatMap, getDigHeatMap, getReceptionHeatMap, getTeamSideout, getMatchPlayerStats, getSetPlayerStats } from '../services/statsAggregator'

const stats = new Hono<{ Bindings: Env }>()

stats.get('/player/:playerId', async (c) => {
  const { playerId } = c.req.param()
  const { scope, seasonId, matchId, setId } = c.req.query()

  const validScopes = ['career', 'season', 'match', 'set'] as const
  type Scope = (typeof validScopes)[number]
  const resolvedScope: Scope = validScopes.includes(scope as Scope)
    ? (scope as Scope)
    : 'career'

  const scopeId = resolvedScope === 'season' ? seasonId
    : resolvedScope === 'match' ? matchId
    : resolvedScope === 'set' ? setId
    : undefined

  const result = await getPlayerStats(c.env.DB, playerId, resolvedScope, scopeId)
  if (!result) return c.json({ error: 'No stats found' }, 404)
  return c.json(result)
})

stats.get('/rotations/:setId', async (c) => {
  const { setId } = c.req.param()
  const { teamId } = c.req.query()
  if (!teamId) return c.json({ error: 'teamId query param required' }, 400)
  const result = await getRotationBreakdown(c.env.DB, setId, teamId)
  return c.json(result)
})

stats.get('/match/:matchId/players', async (c) => {
  const { matchId } = c.req.param()
  const result = await getMatchPlayerStats(c.env.DB, matchId)
  return c.json(result)
})

stats.get('/sets/:setId/players', async (c) => {
  const { setId } = c.req.param()
  const result = await getSetPlayerStats(c.env.DB, setId)
  return c.json(result)
})

stats.get('/team-sideout', async (c) => {
  const { teamId, seasonId, matchId } = c.req.query()
  if (!teamId) return c.json({ error: 'teamId required' }, 400)
  const result = await getTeamSideout(c.env.DB, { teamId, seasonId, matchId })
  return c.json(result)
})

stats.get('/heatmap/attacks', async (c) => {
  const { teamId, playerId, seasonId, matchId } = c.req.query()
  const result = await getAttackHeatMap(c.env.DB, { teamId, playerId, seasonId, matchId })
  return c.json(result)
})

stats.get('/heatmap/digs', async (c) => {
  const { teamId, playerId, seasonId, matchId } = c.req.query()
  const result = await getDigHeatMap(c.env.DB, { teamId, playerId, seasonId, matchId })
  return c.json(result)
})

stats.get('/heatmap/receptions', async (c) => {
  const { teamId, playerId, seasonId, matchId } = c.req.query()
  const result = await getReceptionHeatMap(c.env.DB, { teamId, playerId, seasonId, matchId })
  return c.json(result)
})

export default stats
