import { create } from 'zustand';
import type { GameStore, GameSession, Duchy, Player, GameEvent, BuildingType, DuchyBuilding } from '../types';
import { generateWorld } from '../game/procgen/worldgen';
import {
  harvestResources,
  generateKingDemand,
  subtractCost,
  canAfford,
  BUILDING_COSTS,
  BUILDING_FAVOR,
  findStartingTile,
} from '../game/systems/turnEngine';

const STARTER_RESOURCES = {
  grain: 20, timber: 15, ore: 8,
  cloth: 5,  fish: 5,   spice: 0, gold: 10,
};

export const useGameStore = create<GameStore>((set, get) => ({
  session: null,
  myDuchy: null,
  allDuchies: [],
  players: [],
  events: [],
  gameOver: false,
  victory: false,

  setSession: (session: GameSession) => set({ session }),
  setMyDuchy: (duchy: Duchy) => set({ myDuchy: duchy }),
  setAllDuchies: (duchies: Duchy[]) => set({ allDuchies: duchies }),
  setPlayers: (players: Player[]) => set({ players }),
  addEvent: (event: GameEvent) =>
    set((state) => ({ events: [...state.events, event] })),

  // ─── M1 Game Logic ──────────────────────────────────────────────────────────

  initLocalGame: () => {
    const seed = Date.now();
    const map = generateWorld({ width: 64, height: 64, seed });
    const start = findStartingTile(map);

    // Claim a 3×3 area around the starting tile (skip ocean tiles)
    const claimed: { x: number; y: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = start.x + dx;
        const ty = start.y + dy;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        const tile = map.tiles[ty][tx];
        if (tile.type === 'ocean') continue;
        claimed.push({ x: tx, y: ty });
        map.tiles[ty][tx] = { ...tile, duchyId: 'player-duchy' };
      }
    }

    const session: GameSession = {
      id: 'local-game',
      createdBy: 'player',
      phase: 'active',
      turnPhase: 'planning',
      turnNumber: 1,
      maxTurns: 20,
      playerCount: 1,
      map,
      currentKingDemand: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const duchy: Duchy = {
      id: 'player-duchy',
      gameId: 'local-game',
      playerId: 'player',
      name: 'Your Duchy',
      color: '#f5d87a',
      tiles: claimed,
      resources: { ...STARTER_RESOURCES },
      population: {
        total: 100, farmers: 60, artisans: 20,
        merchants: 15, soldiers: 5, happiness: 70,
      },
      buildings: [],
      kingsFavor: 50,
      developmentMode: 'laissez_faire',
      spyNetwork: 0,
      militaryStrength: 10,
      turnReady: false,
    };

    set({ session, myDuchy: duchy, allDuchies: [duchy], gameOver: false, victory: false });
  },

  endTurn: () => {
    const { session, myDuchy } = get();
    if (!session || !myDuchy) return;
    if (session.currentKingDemand) return; // must respond first

    const newResources = harvestResources(myDuchy, session.map);
    const newTurn = session.turnNumber + 1;

    if (newTurn > session.maxTurns) {
      set({
        session: { ...session, turnNumber: newTurn },
        myDuchy: { ...myDuchy, resources: newResources },
        victory: true,
      });
      return;
    }

    const demand = newTurn % 5 === 0 ? generateKingDemand(newTurn) : null;

    set({
      session: {
        ...session,
        turnNumber: newTurn,
        currentKingDemand: demand,
        updatedAt: new Date().toISOString(),
      },
      myDuchy: { ...myDuchy, resources: newResources },
    });
  },

  placeBuilding: (type: BuildingType, x: number, y: number) => {
    const { session, myDuchy } = get();
    if (!session || !myDuchy) return false;
    if (!myDuchy.tiles.some(t => t.x === x && t.y === y)) return false;
    if (myDuchy.buildings.some(b => b.tileX === x && b.tileY === y)) return false;

    const cost = BUILDING_COSTS[type];
    if (!canAfford(myDuchy.resources, cost)) return false;

    const newBuilding: DuchyBuilding = { id: `b-${x}-${y}`, type, tileX: x, tileY: y, level: 1 };

    set({
      myDuchy: {
        ...myDuchy,
        resources: subtractCost(myDuchy.resources, cost),
        buildings: [...myDuchy.buildings, newBuilding],
        kingsFavor: Math.min(100, myDuchy.kingsFavor + BUILDING_FAVOR[type]),
      },
    });
    return true;
  },

  fulfillDemand: () => {
    const { session, myDuchy } = get();
    if (!session?.currentKingDemand || !myDuchy) return;
    const demand = session.currentKingDemand;
    const cost: Partial<Record<string, number>> = { [demand.resourceType]: demand.amount };
    if (!canAfford(myDuchy.resources, cost as any)) return;

    set({
      session: { ...session, currentKingDemand: null },
      myDuchy: {
        ...myDuchy,
        resources: subtractCost(myDuchy.resources, cost as any),
        kingsFavor: Math.min(100, myDuchy.kingsFavor + demand.favorReward),
      },
    });
  },

  refuseDemand: () => {
    const { session, myDuchy } = get();
    if (!session?.currentKingDemand || !myDuchy) return;
    const newFavor = myDuchy.kingsFavor - session.currentKingDemand.favorPenalty;
    set({
      session: { ...session, currentKingDemand: null },
      myDuchy: { ...myDuchy, kingsFavor: newFavor },
      gameOver: newFavor <= 0,
    });
  },

  restartGame: () => {
    get().initLocalGame();
  },
}));
