import { create } from 'zustand';
import type { UIStore } from '../types';

export const useUIStore = create<UIStore>((set) => ({
  selectedTile: null,
  openPanel: null,

  setSelectedTile: (tile) => set({ selectedTile: tile }),
  setOpenPanel: (panel) => set({ openPanel: panel }),
}));
