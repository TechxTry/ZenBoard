import { create } from 'zustand'

interface AppState {
  selectedGroupId: number | null
  selectedGroupName: string
  setGroup: (id: number, name: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedGroupId: null,
  selectedGroupName: '',
  setGroup: (id, name) => set({ selectedGroupId: id, selectedGroupName: name }),
}))
