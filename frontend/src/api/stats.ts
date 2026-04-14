import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from './client'
import type { PlayerStats, PlayerStatsWithTeam, TeamStats, ServeQualityBucket, RotationBreakdown, HeatMapPoint, CreateSeasonPayload } from '@vst/shared'

/** All global seasons (for match modals — no team context needed). */
export function useAllSeasons() {
  return useQuery({
    queryKey: ['seasons'],
    queryFn: () => api.get<unknown[]>('/seasons'),
  })
}

/** Seasons this team has played in (derived via matches). */
export function useSeasons(teamId: string) {
  return useQuery({
    queryKey: ['seasons', teamId],
    queryFn: () => api.get<unknown[]>(`/teams/${teamId}/seasons`),
    enabled: !!teamId,
  })
}

export function useCreateSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSeasonPayload) => api.post<unknown>('/seasons', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons'] }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateSeason(seasonId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CreateSeasonPayload>) => api.put<unknown>(`/seasons/${seasonId}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons'] }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteSeason(seasonId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<unknown>(`/seasons/${seasonId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons'] }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useMatchPlayerStats(matchId: string) {
  return useQuery({
    queryKey: ['stats', 'match-players', matchId],
    queryFn: () => api.get<PlayerStats[]>(`/stats/match/${matchId}/players`),
    enabled: !!matchId,
    staleTime: 60_000,
  })
}

export function useSetPlayerStats(setId: string) {
  return useQuery({
    queryKey: ['stats', 'set-players', setId],
    queryFn: () => api.get<PlayerStats[]>(`/stats/sets/${setId}/players`),
    enabled: !!setId,
    staleTime: 60_000,
  })
}

export function useTeamSideout(filters: { teamId?: string; seasonId?: string; matchId?: string }) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
  return useQuery({
    queryKey: ['stats', 'team-sideout', filters],
    queryFn: () => api.get<{ sideoutWon: number; sideoutTotal: number; sideoutPct: number }>(`/stats/team-sideout?${params}`),
    enabled: !!filters.teamId,
    staleTime: 60_000,
  })
}

export function usePlayerStats(
  playerId: string,
  scope: 'career' | 'season' | 'match' | 'set' = 'career',
  scopeId?: string
) {
  const params = new URLSearchParams({ scope })
  if (scope === 'season' && scopeId) params.set('seasonId', scopeId)
  if (scope === 'match' && scopeId) params.set('matchId', scopeId)
  if (scope === 'set' && scopeId) params.set('setId', scopeId)

  return useQuery({
    queryKey: ['stats', 'player', playerId, scope, scopeId],
    queryFn: () => api.get<PlayerStats>(`/stats/player/${playerId}?${params}`),
    enabled: !!playerId,
  })
}

export function useTeamPlayerStats(teamId: string, scope?: string, scopeId?: string) {
  const params = new URLSearchParams({ teamId })
  if (scope) params.set('scope', scope)
  if (scopeId) params.set('scopeId', scopeId)
  return useQuery({
    queryKey: ['stats', 'team-players', teamId, scope, scopeId],
    queryFn: () => api.get<PlayerStats[]>(`/stats/players?${params}`),
    enabled: !!teamId,
    staleTime: 60_000,
  })
}

export function useRotationStats(setId: string, teamId: string) {
  return useQuery({
    queryKey: ['stats', 'rotations', setId, teamId],
    queryFn: () => api.get<RotationBreakdown[]>(`/stats/rotations/${setId}?teamId=${teamId}`),
    enabled: !!setId && !!teamId,
  })
}

export function useSeasonLeaderboard(seasonId: string) {
  return useQuery({
    queryKey: ['stats', 'leaderboard', seasonId],
    queryFn: () => api.get<PlayerStatsWithTeam[]>(`/stats/players?seasonId=${seasonId}`),
    enabled: !!seasonId,
    staleTime: 60_000,
  })
}

export function useSeasonTeamStats(seasonId: string) {
  return useQuery({
    queryKey: ['stats', 'season-teams', seasonId],
    queryFn: () => api.get<TeamStats[]>(`/stats/season/${seasonId}/teams`),
    enabled: !!seasonId,
    staleTime: 60_000,
  })
}

export function useServeQualityDist(filters: { teamId?: string; playerId?: string; seasonId?: string; matchId?: string }) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
  return useQuery({
    queryKey: ['stats', 'serve-quality', filters],
    queryFn: () => api.get<ServeQualityBucket[]>(`/stats/serve-quality?${params}`),
    enabled: !!(filters.teamId || filters.playerId || filters.seasonId || filters.matchId),
    staleTime: 60_000,
  })
}

export function useAttackHeatMap(filters: {
  teamId?: string
  playerId?: string
  seasonId?: string
  matchId?: string
}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
  return useQuery({
    queryKey: ['stats', 'heatmap', 'attacks', filters],
    queryFn: () => api.get<HeatMapPoint[]>(`/stats/heatmap/attacks?${params}`),
    enabled: !!(filters.teamId || filters.playerId || filters.seasonId || filters.matchId),
    staleTime: 60_000,
  })
}

export function useDigHeatMap(filters: {
  teamId?: string
  playerId?: string
  seasonId?: string
  matchId?: string
}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
  return useQuery({
    queryKey: ['stats', 'heatmap', 'digs', filters],
    queryFn: () => api.get<HeatMapPoint[]>(`/stats/heatmap/digs?${params}`),
    enabled: !!(filters.teamId || filters.playerId || filters.seasonId || filters.matchId),
    staleTime: 60_000,
  })
}

export function useReceptionHeatMap(filters: {
  teamId?: string
  playerId?: string
  seasonId?: string
  matchId?: string
}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
  return useQuery({
    queryKey: ['stats', 'heatmap', 'receptions', filters],
    queryFn: () => api.get<HeatMapPoint[]>(`/stats/heatmap/receptions?${params}`),
    enabled: !!(filters.teamId || filters.playerId || filters.seasonId || filters.matchId),
    staleTime: 60_000,
  })
}
