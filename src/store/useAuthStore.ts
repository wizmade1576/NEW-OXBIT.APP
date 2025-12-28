import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  sessionChecked: boolean
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  sessionChecked: false,
  setUser: (user) => set({ user, sessionChecked: true }),
  logout: () => set({ user: null, sessionChecked: true }),
}))
