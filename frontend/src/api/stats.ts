import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from './client'
import type { PlayerStats, RotationBreakdown, HeatMapPoint, CreateSeasonPayload } from '@vst/shared'

export function useSeasons(teamId: string) {
  return useQuery({
    queryKey: ['seasons', teamId],
    queryFn: () => api.get<unknown[]>(`/teams/${teamId}/seasons`),
    enabled: !!teamId,
  })
}

export function useCreateSeason(teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSeasonPayload) => api.post<unknown>(`/teams/${teamId}/seasons`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons', teamId] }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateSeason(seasonId: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CreateSeasonPayload>) => api.put<unknown>(`/seasons/${seasonId}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons', teamId] }),
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

export function useRotationStats(setId: string, teamId: string) {
  return useQuery({
    queryKey: ['stats', 'rotations', setId, teamId],
    queryFn: () => api.get<RotationBreakdown[]>(`/stats/rotations/${setId}?teamId=${teamId}`),
    enabled: !!setId && !!teamId,
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
    staleTime: 60_000,
  })
}
