import { create } from 'zustand';
import type { GameStore, GameSession, Duchy, Player, GameEvent } from '../types';

export const useGameStore = create<GameStore>((set) => ({
  session: null,
  myDuchy: null,
  allDuchies: [],
  players: [],
  events: [],

  setSession: (session: GameSession) => set({ session }),
  setMyDuchy: (duchy: Duchy) => set({ myDuchy: duchy }),
  setAllDuchies: (duchies: Duchy[]) => set({ allDuchies: duchies }),
  setPlayers: (players: Player[]) => set({ players }),
  addEvent: (event: GameEvent) =>
    set((state) => ({ events: [...state.events, event] })),
}));
