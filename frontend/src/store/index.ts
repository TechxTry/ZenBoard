import { create } from 'zustand'

export type ThemeMode = 'system' | 'light' | 'dark'

interface AppState {
  selectedGroupId: number | null
  selectedGroupName: string
  setGroup: (id: number, name: string) => void

  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

const THEME_STORAGE_KEY = 'themeMode'
const getInitialThemeMode = (): ThemeMode => {
  const raw = localStorage.getItem(THEME_STORAGE_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

export const useAppStore = create<AppState>((set) => ({
  selectedGroupId: null,
  selectedGroupName: '',
  setGroup: (id, name) => set({ selectedGroupId: id, selectedGroupName: name }),

  themeMode: getInitialThemeMode(),
  setThemeMode: (mode) => {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
    set({ themeMode: mode })
  },
}))
