import { create } from 'zustand'

export interface AuthUser {
  id: string
  email: string
  role: 'admin'
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  setAuth: (user: AuthUser, token: string) => void
  clearAuth: () => void
  loadFromStorage: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,

  setAuth: (user, token) => {
    localStorage.setItem('vst_token', token)
    localStorage.setItem('vst_user', JSON.stringify(user))
    set({ user, token })
  },

  clearAuth: () => {
    localStorage.removeItem('vst_token')
    localStorage.removeItem('vst_user')
    set({ user: null, token: null })
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('vst_token')
    const raw = localStorage.getItem('vst_user')
    if (token && raw) {
      try {
        const user = JSON.parse(raw) as AuthUser
        set({ user, token })
      } catch {
        localStorage.removeItem('vst_token')
        localStorage.removeItem('vst_user')
      }
    }
  },
}))

/** Get the current token without subscribing to the store (safe to call outside React). */
export function getToken(): string | null {
  return useAuthStore.getState().token
}
