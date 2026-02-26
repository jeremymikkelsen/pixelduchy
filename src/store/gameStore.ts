import { create } from 'zustand';
import type { GameStore, GameSession, Duchy, Player, GameEvent, BuildingType, DuchyBuilding, DevelopmentMode, WorldMap, ResourceType } from '../types';
import { generateWorld } from '../game/procgen/worldgen';
import {
  harvestResources,
  generateKingDemand,
  getValidBuildingsForTile,
  subtractCost,
  canAfford,
  BUILDING_COSTS,
  BUILDING_FAVOR,
  findStartingTile,
  findAdjacentUnclaimedTile,
} from '../game/systems/turnEngine';
import { getMarketPrices } from '../game/systems/marketEngine';

const STARTER_RESOURCES = {
  grain: 20, timber: 15, ore: 8,
  cloth: 5,  fish: 5,   spice: 0, gold: 10,
  cattle: 0, deer: 0, apples: 0,
  bread: 0, cheese: 0, smoked_meat: 0, pie: 0,
};

const AI_COLORS = ['#e05050', '#5080e0', '#50c870', '#e0a030', '#a050d0', '#40c8c8', '#e05090'];
const AI_NAMES  = ['Ironhold', 'Brightwater', 'Greenfield', 'Ashenvale', 'Thorngate', 'Coldpeak', 'Sunhaven'];

// Mulberry32 seeded RNG
function makeRng(seed: number): () => number {
  let s = (seed ^ 0x12345678) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function findAIStart(
  map: WorldMap,
  occupied: { x: number; y: number }[],
  minDist: number,
  rng: () => number,
): { x: number; y: number } | null {
  const { width, height, tiles } = map;
  for (let attempt = 0; attempt < 1500; attempt++) {
    const x = 3 + Math.floor(rng() * (width - 6));
    const y = 3 + Math.floor(rng() * (height - 6));
    const tile = tiles[y]?.[x];
    if (!tile || tile.type !== 'plains') continue;
    const tooClose = occupied.some(o => {
      const dx = o.x - x, dy = o.y - y;
      return Math.sqrt(dx * dx + dy * dy) < minDist;
    });
    if (!tooClose) return { x, y };
  }
  return null;
}

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
    const map = generateWorld({ width: 80, height: 80, seed });
    const start = findStartingTile(map);

    // Claim a 4×4 area (from start-1 to start+2 in both axes), skip ocean
    const claimed: { x: number; y: number }[] = [];
    for (let dy = -1; dy <= 2; dy++) {
      for (let dx = -1; dx <= 2; dx++) {
        const tx = start.x + dx;
        const ty = start.y + dy;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        const tile = map.tiles[ty][tx];
        if (tile.type === 'ocean') continue;
        claimed.push({ x: tx, y: ty });
        map.tiles[ty][tx] = { ...tile, duchyId: 'player-duchy' };
      }
    }

    // Place starter buildings on the inner 2×2 of the territory
    const preferredSlots = [
      { x: start.x,     y: start.y     },
      { x: start.x + 1, y: start.y     },
      { x: start.x,     y: start.y + 1 },
      { x: start.x + 1, y: start.y + 1 },
    ];
    const claimedSet = new Set(claimed.map(t => `${t.x},${t.y}`));
    const buildingSlots = preferredSlots.filter(p => {
      const tile = map.tiles[p.y]?.[p.x];
      return tile && tile.type !== 'ocean' && claimedSet.has(`${p.x},${p.y}`);
    });
    // Fill remaining slots from other claimed tiles if needed
    if (buildingSlots.length < 4) {
      const usedSet = new Set(buildingSlots.map(t => `${t.x},${t.y}`));
      for (const t of claimed) {
        if (buildingSlots.length >= 4) break;
        if (usedSet.has(`${t.x},${t.y}`)) continue;
        const tile = map.tiles[t.y]?.[t.x];
        if (tile && tile.type !== 'ocean') {
          buildingSlots.push(t);
          usedSet.add(`${t.x},${t.y}`);
        }
      }
    }

    // Plains-required buildings (field, pasture) must go on plains tiles
    const plainsSlots = buildingSlots.filter(p => map.tiles[p.y]?.[p.x]?.type === 'plains');
    const starterBuildings: DuchyBuilding[] = [];
    const usedSlots = new Set<string>();

    const tryPlace = (type: BuildingType, slots: typeof buildingSlots) => {
      const slot = slots.find(s => !usedSlots.has(`${s.x},${s.y}`));
      if (!slot) return;
      starterBuildings.push({ id: `starter-${starterBuildings.length}`, type, tileX: slot.x, tileY: slot.y, level: 1 });
      usedSlots.add(`${slot.x},${slot.y}`);
    };

    tryPlace('castle',  buildingSlots);
    tryPlace('market',  buildingSlots);
    tryPlace('field',   plainsSlots);
    tryPlace('pasture', plainsSlots);

    // ── Generate 7 AI duchies ──────────────────────────────────────────────────
    const rng = makeRng(seed + 1);
    const aiDuchies: Duchy[] = [];
    const centers: { x: number; y: number }[] = [start];

    for (let i = 0; i < 7; i++) {
      const aiStart = findAIStart(map, centers, 14, rng);
      if (!aiStart) continue;

      centers.push(aiStart);
      const aiId = `ai-duchy-${i}`;
      const aiClaimed: { x: number; y: number }[] = [];

      for (let dy2 = -1; dy2 <= 1; dy2++) {
        for (let dx2 = -1; dx2 <= 1; dx2++) {
          const tx = aiStart.x + dx2, ty = aiStart.y + dy2;
          if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
          const tile = map.tiles[ty][tx];
          if (tile.type === 'ocean' || tile.duchyId !== null) continue;
          aiClaimed.push({ x: tx, y: ty });
          map.tiles[ty][tx] = { ...tile, duchyId: aiId };
        }
      }

      // Place castle at center of AI territory
      const castleTile = aiClaimed[Math.floor(aiClaimed.length / 2)];
      const aiBuildings: DuchyBuilding[] = castleTile
        ? [{ id: `ai-${i}-castle`, type: 'castle', tileX: castleTile.x, tileY: castleTile.y, level: 1 }]
        : [];

      aiDuchies.push({
        id: aiId,
        gameId: 'local-game',
        playerId: aiId,
        name: AI_NAMES[i] ?? `Duchy ${i + 1}`,
        color: AI_COLORS[i] ?? '#888888',
        tiles: aiClaimed,
        resources: { ...STARTER_RESOURCES },
        foodAges: { apples: 0, bread: 0, cheese: 0, smoked_meat: 0 },
        population: { total: 100, farmers: 60, artisans: 20, merchants: 15, soldiers: 5, happiness: 70 },
        buildings: aiBuildings,
        kingsFavor: 50,
        developmentMode: 'laissez_faire',
        spyNetwork: 0,
        militaryStrength: 10,
        turnReady: false,
      });
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
      kingsTileOffer: null,
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
      foodAges: { apples: 0, bread: 0, cheese: 0, smoked_meat: 0 },
      population: {
        total: 100, farmers: 60, artisans: 20,
        merchants: 15, soldiers: 5, happiness: 70,
      },
      buildings: starterBuildings,
      kingsFavor: 50,
      developmentMode: 'laissez_faire',
      spyNetwork: 0,
      militaryStrength: 10,
      turnReady: false,
    };

    const allDuchies = [duchy, ...aiDuchies];
    set({ session, myDuchy: duchy, allDuchies, gameOver: false, victory: false });
  },

  endTurn: () => {
    const { session, myDuchy, allDuchies } = get();
    if (!session || !myDuchy) return;
    if (session.currentKingDemand) return;
    if (session.kingsTileOffer) return;

    const newResources = harvestResources(myDuchy, session.map);
    const newTurn = session.turnNumber + 1;
    const newMyDuchy = { ...myDuchy, resources: newResources };

    if (newTurn > session.maxTurns) {
      set({
        session: { ...session, turnNumber: newTurn },
        myDuchy: newMyDuchy,
        allDuchies: allDuchies.map(d => d.id === myDuchy.id ? newMyDuchy : d),
        victory: true,
      });
      return;
    }

    const demand = newTurn % 5 === 0 ? generateKingDemand(newTurn) : null;

    // King randomly offers an adjacent tile every 3 turns (if no demand)
    let tileOffer: { x: number; y: number } | null = null;
    if (!demand && newTurn % 3 === 0) {
      tileOffer = findAdjacentUnclaimedTile(newMyDuchy.tiles, session.map);
    }

    set({
      session: {
        ...session,
        turnNumber: newTurn,
        currentKingDemand: demand,
        kingsTileOffer: tileOffer,
        updatedAt: new Date().toISOString(),
      },
      myDuchy: newMyDuchy,
      allDuchies: allDuchies.map(d => d.id === myDuchy.id ? newMyDuchy : d),
    });
  },

  placeBuilding: (type: BuildingType, x: number, y: number) => {
    const { session, myDuchy, allDuchies } = get();
    if (!session || !myDuchy) return false;
    if (!myDuchy.tiles.some(t => t.x === x && t.y === y)) return false;
    if (myDuchy.buildings.some(b => b.tileX === x && b.tileY === y)) return false;

    const tile = session.map.tiles[y]?.[x];
    if (!tile) return false;
    if (!getValidBuildingsForTile(tile, session.map).includes(type)) return false;

    const cost = BUILDING_COSTS[type];
    if (!canAfford(myDuchy.resources, cost)) return false;

    const newBuilding: DuchyBuilding = { id: `b-${x}-${y}`, type, tileX: x, tileY: y, level: 1 };
    const newMyDuchy = {
      ...myDuchy,
      resources: subtractCost(myDuchy.resources, cost),
      buildings: [...myDuchy.buildings, newBuilding],
      kingsFavor: Math.min(100, myDuchy.kingsFavor + BUILDING_FAVOR[type]),
    };

    set({
      myDuchy: newMyDuchy,
      allDuchies: allDuchies.map(d => d.id === myDuchy.id ? newMyDuchy : d),
    });
    return true;
  },

  fulfillDemand: () => {
    const { session, myDuchy, allDuchies } = get();
    if (!session?.currentKingDemand || !myDuchy) return;
    const demand = session.currentKingDemand;
    const cost: Partial<Record<string, number>> = { [demand.resourceType]: demand.amount };
    if (!canAfford(myDuchy.resources, cost as any)) return;

    const newMyDuchy = {
      ...myDuchy,
      resources: subtractCost(myDuchy.resources, cost as any),
      kingsFavor: Math.min(100, myDuchy.kingsFavor + demand.favorReward),
    };
    set({
      session: { ...session, currentKingDemand: null },
      myDuchy: newMyDuchy,
      allDuchies: allDuchies.map(d => d.id === myDuchy.id ? newMyDuchy : d),
    });
  },

  refuseDemand: () => {
    const { session, myDuchy, allDuchies } = get();
    if (!session?.currentKingDemand || !myDuchy) return;
    const newFavor = myDuchy.kingsFavor - session.currentKingDemand.favorPenalty;
    const newMyDuchy = { ...myDuchy, kingsFavor: newFavor };
    set({
      session: { ...session, currentKingDemand: null },
      myDuchy: newMyDuchy,
      allDuchies: allDuchies.map(d => d.id === myDuchy.id ? newMyDuchy : d),
      gameOver: newFavor <= 0,
    });
  },

  acceptTileOffer: () => {
    const { session, myDuchy, allDuchies } = get();
    if (!session?.kingsTileOffer || !myDuchy) return;
    const { x, y } = session.kingsTileOffer;

    // Mark tile as owned in the map
    const newTilesGrid = session.map.tiles.map((row, ry) =>
      row.map((tile, rx) =>
        rx === x && ry === y ? { ...tile, duchyId: myDuchy.id } : tile,
      ),
    );
    const newMap = { ...session.map, tiles: newTilesGrid };
    const newMyDuchy = { ...myDuchy, tiles: [...myDuchy.tiles, { x, y }] };

    set({
      session: { ...session, map: newMap, kingsTileOffer: null },
      myDuchy: newMyDuchy,
      allDuchies: allDuchies.map(d => d.id === myDuchy.id ? newMyDuchy : d),
    });
  },

  declineTileOffer: () => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, kingsTileOffer: null } });
  },

  setDistributionMode: (mode: DevelopmentMode) => {
    set((state) => ({
      myDuchy: state.myDuchy ? { ...state.myDuchy, developmentMode: mode } : null,
    }));
  },

  restartGame: () => {
    get().initLocalGame();
  },

  buyResource: (resource: ResourceType, qty: number) => {
    const { myDuchy, allDuchies } = get();
    if (!myDuchy) return;
    const currentStock = myDuchy.resources[resource] ?? 0;
    const { buy } = getMarketPrices(resource, currentStock);
    const totalCost = Math.round(buy * qty * 10) / 10;
    if (myDuchy.resources.gold < totalCost) return;
    const newResources = {
      ...myDuchy.resources,
      gold: Math.round((myDuchy.resources.gold - totalCost) * 10) / 10,
      [resource]: currentStock + qty,
    };
    const newMyDuchy = { ...myDuchy, resources: newResources };
    set({
      myDuchy: newMyDuchy,
      allDuchies: allDuchies.map(d => d.id === myDuchy.id ? newMyDuchy : d),
    });
  },

  sellResource: (resource: ResourceType, qty: number) => {
    const { myDuchy, allDuchies } = get();
    if (!myDuchy) return;
    const currentStock = myDuchy.resources[resource] ?? 0;
    if (currentStock < qty) return;
    const { sell } = getMarketPrices(resource, currentStock);
    const totalGain = Math.round(sell * qty * 10) / 10;
    const newResources = {
      ...myDuchy.resources,
      gold: Math.round((myDuchy.resources.gold + totalGain) * 10) / 10,
      [resource]: currentStock - qty,
    };
    const newMyDuchy = { ...myDuchy, resources: newResources };
    set({
      myDuchy: newMyDuchy,
      allDuchies: allDuchies.map(d => d.id === myDuchy.id ? newMyDuchy : d),
    });
  },
}));
