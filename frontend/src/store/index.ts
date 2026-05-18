import { create } from 'zustand'

export type ThemeMode = 'system' | 'light' | 'dark'

interface AppState {
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
  themeMode: getInitialThemeMode(),
  setThemeMode: (mode) => {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
    set({ themeMode: mode })
  },
}))
