/**
 * Central game state — serializable, separate from rendering.
 * All game data lives here; renderers only read from it.
 */

import { TopographyGenerator } from '../generators/TopographyGenerator';
import { HydrologyGenerator } from '../generators/HydrologyGenerator';
import { Season, nextSeason } from './Season';
import { Duchy } from './Duchy';
import { generateDuchies } from './DuchyGenerator';
import { generateRoads, RoadSegment } from '../generators/RoadGenerator';
import { DuchyEconomy, createDuchyEconomy, processEconomyTurn, countTerrain } from './Economy';
import { getStartingFavor } from './HouseBonus';
import type { SaveData } from './SaveLoad';
import { AgImprovementType, assignAgImprovements } from './AgImprovements';
import { KingData, selectKing } from './King';
import type { WoodcutterState, FishingCampState, MineState, SmelterState, BuildingInstance, BuildingType } from './Building';
import { BUILDING_DEFS, canPlaceOnTerrain, canAffordAdjustedBuilding, getAdjustedCost } from './Building';
import { assignWoodcutters } from './WoodcutterAssignment';
import { assignFishingCamps } from './FishingCampAssignment';
import { assignMines } from './MineAssignment';
import { assignSmelters } from './SmelterAssignment';
import { buildAdjacencyList } from '../utils/adjacency';
import { RIVER_THRESHOLD } from '../generators/utils';

export interface GameState {
  seed: number;
  mapSize: number;
  turn: number;
  season: Season;
  year: number;
  playerDuchy: number; // index into duchies[] for the player's house

  // Terrain (generated once, immutable after creation)
  topo: TopographyGenerator;
  hydro: HydrologyGenerator;

  // Political
  duchies: Duchy[];
  regionToDuchy: Int8Array;
  king: KingData;

  // Infrastructure
  roads: RoadSegment[];

  // Agricultural improvements — deterministic from seed, one per type per duchy
  agImprovements: Map<number, AgImprovementType>;

  // Economy — one per duchy, indexed same as duchies[]
  economies: DuchyEconomy[];

  // Woodcutters — one per duchy (duchyIndex → state)
  woodcutters: Map<number, WoodcutterState>;
  // Fishing camps — one per duchy (duchyIndex → state)
  fishingCamps: Map<number, FishingCampState>;
  // Iron mines — some duchies only (duchyIndex → state)
  mines: Map<number, MineState>;
  // Smelters — only duchies with mines (duchyIndex → state)
  smelters: Map<number, SmelterState>;
  // Player-placed buildings (region → building)
  buildings: BuildingInstance[];
  _nextBuildingId: number;

  // Player-placed buildings registered into specialized state for rich rendering
  playerAgRegions: Map<number, AgImprovementType>;     // region → type
  playerWoodcutters: WoodcutterState[];
  playerFishingCamps: FishingCampState[];
  playerMines: MineState[];
  playerSmelters: SmelterState[];

  // Tree trunk positions permanently removed by woodcutters (pixel indices: y * N + x)
  removedTrees: Set<number>;
}

/**
 * Create a fully initialized GameState from a seed (new game).
 * @param playerHouse - index into HOUSES[] for the player's chosen house
 */
// Pixel resolution used for building placement (must match MapScene PIXEL_RESOLUTION)
export const PIXEL_RESOLUTION = 1536;

export function createGameState(seed: number, mapSize: number, playerHouse: number = 0): GameState {
  const topo = new TopographyGenerator(mapSize, seed);
  const hydro = new HydrologyGenerator(topo, seed);
  const { duchies, regionToDuchy } = generateDuchies(topo, hydro, seed);
  const roads = generateRoads(topo, hydro, duchies);
  const agImprovements = assignAgImprovements(topo, hydro, duchies, seed, roads);
  const king = selectKing(seed);
  const woodcutters = assignWoodcutters(topo, hydro, duchies, seed, PIXEL_RESOLUTION, roads, agImprovements);
  const fishingCamps = assignFishingCamps(topo, hydro, duchies, seed, PIXEL_RESOLUTION);
  const mines = assignMines(topo, hydro, duchies, seed, PIXEL_RESOLUTION, roads, agImprovements);
  const smelters = assignSmelters(topo, hydro, duchies, seed, PIXEL_RESOLUTION, mines, roads, agImprovements);

  // Initialize economies for each duchy (player gets house-specific starting favor)
  const economies = duchies.map((duchy, i) => {
    const favor = i === playerHouse ? getStartingFavor(duchy.house) : 50;
    return createDuchyEconomy(favor);
  });

  return {
    seed,
    mapSize,
    turn: 0,
    season: Season.Spring,
    year: 1,
    playerDuchy: playerHouse,
    topo,
    hydro,
    duchies,
    regionToDuchy,
    king,
    roads,
    agImprovements,
    economies,
    woodcutters,
    fishingCamps,
    mines,
    smelters,
    buildings: [],
    _nextBuildingId: 1,
    playerAgRegions: new Map(),
    playerWoodcutters: [],
    playerFishingCamps: [],
    playerMines: [],
    playerSmelters: [],
    removedTrees: new Set(),
  };
}

/**
 * Restore a GameState from save data.
 * Regenerates terrain/duchies/roads from seed, then applies saved mutable state.
 */
export function loadGameState(save: SaveData): GameState {
  const topo = new TopographyGenerator(save.mapSize, save.seed);
  const hydro = new HydrologyGenerator(topo, save.seed);
  const { duchies, regionToDuchy } = generateDuchies(topo, hydro, save.seed);
  const roads = generateRoads(topo, hydro, duchies);
  const agImprovements = assignAgImprovements(topo, hydro, duchies, save.seed, roads);
  const king = selectKing(save.seed);
  const woodcutters = assignWoodcutters(topo, hydro, duchies, save.seed, PIXEL_RESOLUTION, roads, agImprovements);
  const fishingCamps = assignFishingCamps(topo, hydro, duchies, save.seed, PIXEL_RESOLUTION);
  const mines = assignMines(topo, hydro, duchies, save.seed, PIXEL_RESOLUTION, roads, agImprovements);
  const smelters = assignSmelters(topo, hydro, duchies, save.seed, PIXEL_RESOLUTION, mines, roads, agImprovements);

  // Restore mutable woodcutter state from save
  if (save.woodcutterLumber) {
    for (const [diStr, count] of Object.entries(save.woodcutterLumber)) {
      const wc = woodcutters.get(Number(diStr));
      if (wc) wc.lumberCount = count as number;
    }
  }

  // Restore mutable mine/smelter state from save
  if (save.mineOre) {
    for (const [diStr, count] of Object.entries(save.mineOre)) {
      const mine = mines.get(Number(diStr));
      if (mine) mine.oreCount = count as number;
    }
  }
  if (save.smelterIngots) {
    for (const [diStr, count] of Object.entries(save.smelterIngots)) {
      const smelter = smelters.get(Number(diStr));
      if (smelter) smelter.ingotCount = count as number;
    }
  }

  // Restore player-placed specialized buildings
  const playerAgRegions = new Map<number, AgImprovementType>();
  if (save.playerAgRegions) {
    for (const [rStr, type] of Object.entries(save.playerAgRegions)) {
      const agType = type as AgImprovementType;
      playerAgRegions.set(Number(rStr), agType);
      agImprovements.set(Number(rStr), agType); // merge into main map
    }
  }

  const scale = topo.size / PIXEL_RESOLUTION;
  const adj = buildAdjacencyList(topo.mesh);
  const playerWoodcutters = (save.playerWoodcutters ?? []).map((pw: Record<string, unknown>) =>
    rebuildWoodcutterState(topo, hydro, adj, scale, pw.regionIndex as number, pw.duchyIndex as number, pw.lumberCount as number),
  );
  const playerFishingCamps = (save.playerFishingCamps ?? []).map((pf: Record<string, unknown>) =>
    rebuildFishingCampState(topo, hydro, adj, scale, pf.regionIndex as number, pf.duchyIndex as number),
  );
  const playerMines = (save.playerMines ?? []).map((pm: Record<string, unknown>) =>
    rebuildMineState(topo, adj, scale, pm.regionIndex as number, pm.duchyIndex as number, pm.oreCount as number),
  );
  const playerSmelters = (save.playerSmelters ?? []).map((ps: Record<string, unknown>) =>
    rebuildSmelterState(topo, hydro, adj, scale, ps.regionIndex as number, ps.duchyIndex as number, ps.ingotCount as number),
  );

  return {
    seed: save.seed,
    mapSize: save.mapSize,
    turn: save.turn,
    season: save.season,
    year: save.year,
    playerDuchy: save.playerDuchy,
    topo,
    hydro,
    duchies,
    regionToDuchy,
    king,
    roads,
    agImprovements,
    economies: save.economies,
    woodcutters,
    fishingCamps,
    mines,
    smelters,
    buildings: save.buildings ?? [],
    _nextBuildingId: save._nextBuildingId ?? 1,
    playerAgRegions,
    playerWoodcutters,
    playerFishingCamps,
    playerMines,
    playerSmelters,
    removedTrees: new Set(save.removedTrees ?? []),
  };
}

/**
 * Advance the game by one turn (one season).
 * Processes economy for all duchies.
 */
export function advanceTurn(state: GameState): void {
  state.turn++;
  state.season = nextSeason(state.season);
  state.year = Math.floor(state.turn / 4) + 1;

  // Process economy for each duchy
  const terrainTypes = state.topo.terrainType;
  for (let i = 0; i < state.duchies.length; i++) {
    const duchy = state.duchies[i];
    const terrain = countTerrain(
      duchy.regions, terrainTypes, duchy.hasRiver, duchy.hasForest,
    );
    state.economies[i] = processEconomyTurn(state.economies[i], terrain, duchy.house);

    // Woodcutter timber production
    const wc = state.woodcutters.get(i);
    if (wc) {
      const treesPerSeason = wc.variant === 'sawmill' ? 3 : 1;
      wc.lumberCount += treesPerSeason;
      const timberYield = wc.variant === 'sawmill' ? 5 : 1;
      state.economies[i].resources.timber += timberYield;
    }

    // Mine ore production
    const mine = state.mines.get(i);
    if (mine) {
      mine.oreCount += 4;
      state.economies[i].resources.ore += 4;
    }

    // Smelter iron production (consumes ore)
    const smelter = state.smelters.get(i);
    if (smelter && mine) {
      const consumed = Math.min(2, state.economies[i].resources.ore);
      state.economies[i].resources.ore -= consumed;
      smelter.ingotCount += consumed;
      state.economies[i].resources.iron += consumed;
    }

    // Process buildings that consume inputs
    // For now, check if the duchy has these buildings placed
    // TODO: Once building placement is implemented, iterate over placedBuildings instead
    const processorTypes = ['kitchen', 'smokehouse', 'weaver', 'dairy', 'bakery'] as const;
    for (const type of processorTypes) {
      const def = BUILDING_DEFS[type];
      if (def.consumes) {
        // For now, each duchy can process if they have the resources
        // This will be gated by actual building placement later
        // processBuilding(eco.resources, def.consumes, def.yields);
      }
    }

    // Finish construction for buildings that were under construction last turn
    for (const b of state.buildings) {
      if (b.duchyIndex !== i) continue;
      if (b.constructing) {
        b.constructing = false;
        // Register into specialized state for rich rendering
        registerCompletedBuilding(state, b);
        continue; // no yields on the turn construction finishes
      }
      // Player-placed building yields (only when built)
      const def = BUILDING_DEFS[b.type];
      for (const y of def.yields) {
        const key = y.resource as keyof typeof state.economies[0]['resources'];
        state.economies[i].resources[key] += y.amount * b.level;
      }
    }
  }
}

/**
 * Attempt to place a building on a region for a duchy.
 * Returns true if successful, false if placement is invalid or unaffordable.
 */
export function placeBuilding(
  state: GameState,
  duchyIndex: number,
  region: number,
  buildingType: BuildingType,
  hasRiver: boolean,
  hasForest: boolean,
): boolean {
  const def = BUILDING_DEFS[buildingType];
  const terrain = state.topo.terrainType[region];
  const eco = state.economies[duchyIndex];

  // Validate ownership
  if (state.regionToDuchy[region] !== duchyIndex) return false;

  // Validate terrain
  if (!canPlaceOnTerrain(def, terrain, hasRiver, hasForest)) return false;

  // Validate affordability (with house bonus modifiers)
  const res = eco.resources as unknown as Record<string, number>;
  const duchy = state.duchies[duchyIndex];
  const house = duchy?.house ?? null;
  if (!canAffordAdjustedBuilding(def, res, house)) return false;

  // Check region isn't already occupied by a player-placed building
  if (state.buildings.some(b => b.region === region)) return false;

  // Deduct adjusted costs
  const adjustedCost = getAdjustedCost(def, house);
  for (const [resource, amount] of Object.entries(adjustedCost)) {
    const key = resource as keyof typeof eco.resources;
    eco.resources[key] -= amount ?? 0;
  }

  // Place building (starts as under construction)
  state.buildings.push({
    id: state._nextBuildingId++,
    type: buildingType,
    region,
    level: 1,
    duchyIndex,
    constructing: true,
  });

  // One-time favor bonus
  if (def.favorOnBuild > 0) {
    eco.kingsFavor += def.favorOnBuild;
  }

  return true;
}

// ── Building type → specialized state mapping ─────────────────────────────

const AG_TYPE_MAP: Partial<Record<BuildingType, AgImprovementType>> = {
  field: 'grain',
  pasture: 'pasture',
  orchard: 'orchard',
};

/** Set of building types handled by specialized renderers */
export const SPECIALIZED_BUILDING_TYPES = new Set<BuildingType>([
  'field', 'pasture', 'orchard',
  'woodcutter', 'sawmill',
  'fishery',
  'mine',
  'smelter',
]);

const WHARF_RIVER_THRESHOLD = RIVER_THRESHOLD * 4;

/**
 * Register a completed player-placed building into the appropriate
 * specialized state so it is rendered by the rich renderer (FarmRenderer,
 * WoodcutterRenderer, etc.) instead of the generic PlacedBuildingRenderer.
 */
function registerCompletedBuilding(state: GameState, b: BuildingInstance): void {
  const agType = AG_TYPE_MAP[b.type];
  if (agType) {
    state.agImprovements.set(b.region, agType);
    state.playerAgRegions.set(b.region, agType);
    return;
  }

  const scale = state.topo.size / PIXEL_RESOLUTION;
  const adj = buildAdjacencyList(state.topo.mesh);

  switch (b.type) {
    case 'woodcutter':
    case 'sawmill':
      state.playerWoodcutters.push(
        rebuildWoodcutterState(state.topo, state.hydro, adj, scale, b.region, b.duchyIndex, 0),
      );
      break;
    case 'fishery':
      state.playerFishingCamps.push(
        rebuildFishingCampState(state.topo, state.hydro, adj, scale, b.region, b.duchyIndex),
      );
      break;
    case 'mine':
      state.playerMines.push(
        rebuildMineState(state.topo, adj, scale, b.region, b.duchyIndex, 0),
      );
      break;
    case 'smelter':
      state.playerSmelters.push(
        rebuildSmelterState(state.topo, state.hydro, adj, scale, b.region, b.duchyIndex, 0),
      );
      break;
  }
}

// ── Helpers to build specialized state from a region ──────────────────────

function rebuildWoodcutterState(
  topo: TopographyGenerator,
  hydro: HydrologyGenerator,
  adj: number[][],
  scale: number,
  region: number,
  duchyIndex: number,
  lumberCount: number,
): WoodcutterState {
  const pt = topo.mesh.points[region];
  const hutPx = Math.floor(pt.x / scale);
  const hutPy = Math.floor(pt.y / scale);

  // Check river proximity for sawmill variant
  let nearRiver = hydro.flowAccumulation[region] >= RIVER_THRESHOLD;
  if (!nearRiver && adj[region]) {
    for (const n of adj[region]) {
      if (hydro.flowAccumulation[n] >= RIVER_THRESHOLD) {
        nearRiver = true;
        break;
      }
    }
  }

  return {
    regionIndex: region,
    duchyIndex,
    variant: nearRiver ? 'sawmill' : 'manual',
    hutPx,
    hutPy,
    lumberCount,
  };
}

function rebuildFishingCampState(
  topo: TopographyGenerator,
  hydro: HydrologyGenerator,
  adj: number[][],
  scale: number,
  region: number,
  duchyIndex: number,
): FishingCampState {
  const pt = topo.mesh.points[region];
  const hutPx = Math.floor(pt.x / scale);
  const hutPy = Math.floor(pt.y / scale);

  // Determine variant: check if near ocean or river
  let hasOcean = false;
  let hasRiver = false;
  const neighbors = adj[region] ?? [];
  for (const n of neighbors) {
    const nt = topo.terrainType[n];
    if (nt === 'ocean' || nt === 'water') hasOcean = true;
    if (hydro.flowAccumulation[n] >= WHARF_RIVER_THRESHOLD) hasRiver = true;
  }
  const variant: 'ocean' | 'river' = hasOcean ? 'ocean' : 'river';

  // Compute water direction
  let wx = 0, wy = 0;
  for (const n of neighbors) {
    const nt = topo.terrainType[n];
    const isTarget = variant === 'ocean'
      ? (nt === 'ocean' || nt === 'water')
      : hydro.flowAccumulation[n] >= WHARF_RIVER_THRESHOLD;
    if (isTarget) {
      const npt = topo.mesh.points[n];
      wx += npt.x - pt.x;
      wy += npt.y - pt.y;
    }
  }
  const wlen = Math.sqrt(wx * wx + wy * wy);
  const waterDirX = wlen > 0 ? wx / wlen : 0;
  const waterDirY = wlen > 0 ? wy / wlen : 1;

  const dockLength = variant === 'ocean' ? 24 : 12;
  const dockPx = Math.round(hutPx + waterDirX * dockLength);
  const dockPy = Math.round(hutPy + waterDirY * dockLength);

  return {
    regionIndex: region,
    duchyIndex,
    variant,
    hutPx,
    hutPy,
    dockPx,
    dockPy,
    waterDirX,
    waterDirY,
  };
}

function rebuildMineState(
  topo: TopographyGenerator,
  adj: number[][],
  scale: number,
  region: number,
  duchyIndex: number,
  oreCount: number,
): MineState {
  const pt = topo.mesh.points[region];
  const entrancePx = Math.floor(pt.x / scale);
  const entrancePy = Math.floor(pt.y / scale);

  // Compute rock direction
  const neighbors = adj[region] ?? [];
  let rx = 0, ry = 0;
  for (const n of neighbors) {
    const nt = topo.terrainType[n];
    if (nt === 'rock' || nt === 'cliff') {
      const np = topo.mesh.points[n];
      rx += np.x - pt.x;
      ry += np.y - pt.y;
    }
  }
  const rlen = Math.sqrt(rx * rx + ry * ry);

  return {
    regionIndex: region,
    duchyIndex,
    entrancePx,
    entrancePy,
    rockDirX: rlen > 0 ? rx / rlen : 0,
    rockDirY: rlen > 0 ? ry / rlen : 1,
    oreCount,
  };
}

function rebuildSmelterState(
  topo: TopographyGenerator,
  hydro: HydrologyGenerator,
  adj: number[][],
  scale: number,
  region: number,
  duchyIndex: number,
  ingotCount: number,
): SmelterState {
  const pt = topo.mesh.points[region];
  const buildingPx = Math.floor(pt.x / scale);
  const buildingPy = Math.floor(pt.y / scale);

  // Check river adjacency
  let nearRiver = hydro.flowAccumulation[region] >= RIVER_THRESHOLD;
  if (!nearRiver) {
    const neighbors = adj[region] ?? [];
    for (const n of neighbors) {
      if (hydro.flowAccumulation[n] >= RIVER_THRESHOLD) {
        nearRiver = true;
        break;
      }
    }
  }

  return {
    regionIndex: region,
    duchyIndex,
    buildingPx,
    buildingPy,
    nearRiver,
    ingotCount,
  };
}
