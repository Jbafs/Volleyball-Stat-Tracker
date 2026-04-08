import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from './client'
import type { Team, CreateTeamPayload } from '@vst/shared'

export const teamKeys = {
  all: ['teams'] as const,
  detail: (id: string) => ['teams', id] as const,
}

export function useTeams() {
  return useQuery({ queryKey: teamKeys.all, queryFn: () => api.get<Team[]>('/teams') })
}

export function useTeam(id: string) {
  return useQuery({ queryKey: teamKeys.detail(id), queryFn: () => api.get<Team>(`/teams/${id}`), enabled: !!id })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTeamPayload) => api.post<Team>('/teams', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  })
}

export function useUpdateTeam(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CreateTeamPayload>) => api.put<Team>(`/teams/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/teams/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.all }),
  })
}

export function useSaveTeamDefaultLineup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, defaultLineup, defaultStartingRotation }: {
      teamId: string
      defaultLineup: Record<string, string>
      defaultStartingRotation?: number
    }) => api.patch(`/teams/${teamId}/default-lineup`, { defaultLineup, defaultStartingRotation }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all })
      toast.success('Default lineup saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
