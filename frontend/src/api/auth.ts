import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from './client'
import { useAuthStore, type AuthUser } from '../store/authStore'

export function useLogin() {
  const { setAuth } = useAuthStore()
  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      api.post<{ token: string; user: AuthUser }>('/auth/login', payload),
    onSuccess: (data) => {
      setAuth(data.user, data.token)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useLogout() {
  const { clearAuth } = useAuthStore()
  return useMutation({
    mutationFn: () => api.post('/auth/logout', {}),
    onSuccess: () => clearAuth(),
    onError: () => {
      // Clear locally even if server-side deletion fails
      clearAuth()
    },
  })
}

export function useCreateProposal() {
  return useMutation({
    mutationFn: (payload: unknown) => api.post<{ id: string }>('/proposals', payload),
    onSuccess: () => toast.success('Proposal submitted — thank you!'),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useReviewProposal() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: string; rejectReason?: string }) =>
      api.patch(`/proposals/${id}`, body),
    onError: (e: Error) => toast.error(e.message),
  })
}
