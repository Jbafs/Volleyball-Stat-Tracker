import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from './client'
import type { Rally, RallyAction, CreateRallyPayload, SubmitRallyPayload } from '@vst/shared'

/** Minimal shape of a submitted rally row from the API (snake_case D1) */
export interface SubmittedRally {
  id: string
  rally_number: number
  home_score_before: number
  away_score_before: number
  winning_team_id: string | null
  point_type: string | null
}

export const rallyKeys = {
  bySet: (setId: string) => ['rallies', 'set', setId] as const,
  actions: (rallyId: string) => ['rally-actions', rallyId] as const,
}

export function useSetRallies(setId: string) {
  return useQuery({
    queryKey: rallyKeys.bySet(setId),
    queryFn: () => api.get<Rally[]>(`/sets/${setId}/rallies`),
    enabled: !!setId,
  })
}

export function useRallyActions(rallyId: string) {
  return useQuery({
    queryKey: rallyKeys.actions(rallyId),
    queryFn: () => api.get<RallyAction[]>(`/rallies/${rallyId}/actions`),
    enabled: !!rallyId,
  })
}

export function useCreateRally(setId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRallyPayload) => api.post<Rally>(`/sets/${setId}/rallies`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: rallyKeys.bySet(setId) }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useSubmitRally(setId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rallyId, payload }: { rallyId: string; payload: SubmitRallyPayload }) =>
      api.post<{ rallyId: string; nextHomeRotation: number; nextAwayRotation: number; nextServingTeamId: string; homeScore: number; awayScore: number }>(
        `/rallies/${rallyId}/submit`, payload
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rallyKeys.bySet(setId) })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteRally(setId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rallyId: string) => api.delete(`/rallies/${rallyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rallyKeys.bySet(setId) })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Rally deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
