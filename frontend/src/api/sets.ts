import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from './client'
import type { LineupSlot, UpsertLineupPayload, CreateSubstitutionPayload, Substitution } from '@vst/shared'

export const lineupKeys = {
  set: (setId: string) => ['lineup', setId] as const,
}

export const setKeys = {
  detail: (setId: string) => ['sets', setId] as const,
}

export function useUpdateSet(setId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { status?: string; homeScore?: number; awayScore?: number }) =>
      api.put(`/sets/${setId}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useSetLineup(setId: string) {
  return useQuery({
    queryKey: lineupKeys.set(setId),
    queryFn: () => api.get<LineupSlot[]>(`/sets/${setId}/lineup`),
    enabled: !!setId,
  })
}

export function useUpsertLineup(setId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpsertLineupPayload) =>
      api.post<LineupSlot[]>(`/sets/${setId}/lineup`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: lineupKeys.set(setId) }),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useCreateSubstitution(setId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSubstitutionPayload) =>
      api.post<Substitution>(`/sets/${setId}/substitutions`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: lineupKeys.set(setId) }),
    onError: (e: Error) => toast.error(e.message),
  })
}
