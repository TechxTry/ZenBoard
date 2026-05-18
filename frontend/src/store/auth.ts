import { create } from 'zustand'
import { getMe, type MeResponse } from '../api'

type AuthState = {
  me: MeResponse | null
  loading: boolean
  error: string | null
  setMe: (me: MeResponse | null) => void
  fetchMe: () => Promise<MeResponse | null>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  me: null,
  loading: false,
  error: null,
  setMe: (me) => set({ me }),
  fetchMe: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ me: null, loading: false, error: null })
      return null
    }
    if (get().loading) return get().me
    set({ loading: true, error: null })
    try {
      const me = await getMe()
      set({ me, loading: false, error: null })
      return me
    } catch (e: any) {
      set({ me: null, loading: false, error: e?.message ?? 'failed to load me' })
      return null
    }
  },
}))

