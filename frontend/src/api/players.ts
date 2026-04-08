import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Player, CreatePlayerPayload } from '@vst/shared'

export const playerKeys = {
  byTeam: (teamId: string) => ['players', 'team', teamId] as const,
  detail: (id: string) => ['players', id] as const,
}

export function useTeamPlayers(teamId: string) {
  return useQuery({
    queryKey: playerKeys.byTeam(teamId),
    queryFn: () => api.get<Player[]>(`/teams/${teamId}/players`),
    enabled: !!teamId,
  })
}

export function usePlayer(id: string) {
  return useQuery({
    queryKey: playerKeys.detail(id),
    queryFn: () => api.get<Player>(`/players/${id}`),
    enabled: !!id,
  })
}

export function useCreatePlayer(teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePlayerPayload) => api.post<Player>(`/teams/${teamId}/players`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: playerKeys.byTeam(teamId) }),
  })
}

export function useUpdatePlayer(id: string, teamId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<CreatePlayerPayload> & { isActive?: boolean }) =>
      api.put<Player>(`/players/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: playerKeys.byTeam(teamId) }),
  })
}
