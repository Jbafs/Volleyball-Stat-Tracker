import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Match, SetRecord, CreateMatchPayload, CreateSetPayload } from '@vst/shared'

export const matchKeys = {
  all: (filters?: Record<string, string>) => ['matches', filters] as const,
  detail: (id: string) => ['matches', id] as const,
  sets: (matchId: string) => ['matches', matchId, 'sets'] as const,
}

export function useMatches(filters?: { seasonId?: string; teamId?: string; status?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams()
  if (filters?.seasonId) params.set('seasonId', filters.seasonId)
  if (filters?.teamId) params.set('teamId', filters.teamId)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.limit != null) params.set('limit', String(filters.limit))
  if (filters?.offset != null) params.set('offset', String(filters.offset))
  const qs = params.toString()

  return useQuery({
    queryKey: matchKeys.all(filters as Record<string, string>),
    queryFn: () => api.get<Match[]>(`/matches${qs ? `?${qs}` : ''}`),
  })
}

export function useMatch(id: string) {
  return useQuery({
    queryKey: matchKeys.detail(id),
    queryFn: () => api.get<Match>(`/matches/${id}`),
    enabled: !!id,
  })
}

export function useCreateMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateMatchPayload) => api.post<Match>('/matches', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  })
}

export function useMatchSets(matchId: string) {
  return useQuery({
    queryKey: matchKeys.sets(matchId),
    queryFn: () => api.get<SetRecord[]>(`/matches/${matchId}/sets`),
    enabled: !!matchId,
  })
}

export function useCreateSet(matchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSetPayload) => api.post<SetRecord>(`/matches/${matchId}/sets`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.sets(matchId) })
    },
  })
}

export function useUpdateMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, ...body }: { matchId: string; format?: 'bo3' | 'bo5'; matchDate?: string; location?: string | null; notes?: string | null; seasonId?: string | null }) =>
      api.put(`/matches/${matchId}`, body),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      qc.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
    },
  })
}

export function useUpdateMatchStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, status }: { matchId: string; status: string }) =>
      api.patch(`/matches/${matchId}/status`, { status }),
    onSuccess: (_data, { matchId }) => {
      qc.invalidateQueries({ queryKey: ['matches'] })
      qc.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
    },
  })
}

export function useDeleteMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (matchId: string) => api.delete(`/matches/${matchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  })
}
