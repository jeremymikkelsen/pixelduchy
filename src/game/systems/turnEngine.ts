import type { BuildingType, Duchy, KingDemand, ResourceType, Resources, Tile, WorldMap } from '../../types';

// ─── Building data ────────────────────────────────────────────────────────────

export const BUILDING_COSTS: Record<BuildingType, Partial<Resources>> = {
  // Food production — plains only
  field:      { timber: 2 },
  pasture:    { timber: 3 },
  orchard:    { timber: 2 },
  // Water / coast
  fishery:    { timber: 4 },
  // Food processing
  smokehouse: { timber: 3 },
  kitchen:    { timber: 2, grain: 1 },
  // Economic
  mill:     { grain: 5, timber: 3 },
  mine:     { timber: 4 },
  sawmill:  { timber: 3, grain: 2 },
  port:     { timber: 6 },
  barracks: { timber: 5, ore: 4 },
  market:   { gold: 3, cloth: 2 },
  church:   { timber: 4, gold: 2 },
  castle:   { timber: 8, ore: 6, gold: 4 },
  // Residential
  house:    { timber: 2, grain: 1 },
};

export const BUILDING_YIELDS: Record<BuildingType, Partial<Resources>> = {
  // Food production
  field:      { grain: 3 },
  pasture:    { cattle: 2 },
  orchard:    { apples: 2 },
  fishery:    { fish: 3 },
  // Food processing
  smokehouse: { smoked_meat: 2 },
  kitchen:    { bread: 2 },
  // Economic
  mill:     { grain: 4 },
  mine:     { ore: 4 },
  sawmill:  { timber: 4 },
  port:     { fish: 3, gold: 1 },
  barracks: {},
  market:   { gold: 3 },
  church:   {},
  castle:   { gold: 2 },
  // Residential
  house:    {},
};

/** Favor granted once on construction */
export const BUILDING_FAVOR: Record<BuildingType, number> = {
  field: 0, pasture: 0, orchard: 0, fishery: 0, smokehouse: 0, kitchen: 0,
  mill: 0, mine: 0, sawmill: 0, port: 0,
  barracks: 0, market: 0, church: 3, castle: 0, house: 0,
};

/** Short code shown on the map tile */
export const BUILDING_LABELS: Record<BuildingType, string> = {
  field: 'FLD', pasture: 'PST', orchard: 'ORC', fishery: 'FSH',
  smokehouse: 'SMK', kitchen: 'KTC',
  mill: 'MLI', mine: 'MNE', sawmill: 'SAW', port: 'PRT',
  barracks: 'BRK', market: 'MKT', church: 'CHR', castle: 'CST', house: 'HSE',
};

export const BUILDING_DESCRIPTIONS: Record<BuildingType, string> = {
  field:      '+3 grain/turn (plains)',
  pasture:    '+2 cattle/turn (plains)',
  orchard:    '+2 apples/turn (plains)',
  fishery:    '+3 fish/turn (coast/river)',
  smokehouse: '+2 smoked meat/turn',
  kitchen:    '+2 bread/turn',
  mill:     '+4 grain/turn (river or hill)',
  mine:     '+4 ore/turn (mountain)',
  sawmill:  '+4 timber/turn (river/hill + forest)',
  port:     '+3 fish, +1 gold/turn (coast/river)',
  barracks: '+10 military strength (plains)',
  market:   '+3 gold/turn (plains)',
  church:   '+3 favor on build',
  castle:   '+2 gold/turn',
  house:    '+10 population capacity (plains)',
};

// ─── Terrain helpers ──────────────────────────────────────────────────────────

/** True if the tile is a hill: mountain elevation but plains underlying biome. */
export function isHillTile(tile: Tile): boolean {
  return tile.type === 'mountain' && (tile.visualType ?? tile.type) === 'plains';
}

/** True if the tile sits on a river segment. */
export function isRiverTile(tile: Tile, map: WorldMap): boolean {
  return (map.rivers ?? []).some(path =>
    path.some(p => p.x === tile.x && p.y === tile.y),
  );
}

/** True if any 4-directional neighbour of this tile is forest. */
function hasAdjacentForest(tile: Tile, map: WorldMap): boolean {
  return (
    [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]
  ).some(([dx, dy]) => map.tiles[tile.y + dy]?.[tile.x + dx]?.type === 'forest');
}

/**
 * Returns which building types may be placed on a tile based on terrain rules:
 *   mine      — mountain tiles only
 *   port      — coast or river
 *   fishery   — coast or river
 *   mill      — river or hill
 *   sawmill   — (river + adjacent forest) or hill
 *   field, pasture, orchard, house, barracks, market — plains only
 *   castle, church, smokehouse, kitchen — any non-ocean tile
 */
export function getValidBuildingsForTile(tile: Tile, map: WorldMap): BuildingType[] {
  if (tile.type === 'ocean') return [];

  const onRiver = isRiverTile(tile, map);
  const hill    = isHillTile(tile);
  const valid: BuildingType[] = [];

  // Universal (any non-ocean tile)
  valid.push('castle', 'church', 'smokehouse', 'kitchen');

  // Plains only
  if (tile.type === 'plains') {
    valid.push('field', 'pasture', 'orchard', 'house', 'barracks', 'market');
  }

  // Mountain tiles (includes hills)
  if (tile.type === 'mountain') {
    valid.push('mine');
  }

  // Mill: river or hill (water / wind power)
  if (onRiver || hill) {
    valid.push('mill');
  }

  // Sawmill: hill (wind), or river with adjacent forest (timber supply)
  if (hill || (onRiver && hasAdjacentForest(tile, map))) {
    valid.push('sawmill');
  }

  // Port & fishery: coast or river
  if (tile.type === 'coast' || onRiver) {
    valid.push('port', 'fishery');
  }

  return valid;
}

// ─── Resource helpers ─────────────────────────────────────────────────────────

export function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return Object.entries(cost).every(
    ([r, amt]) => (resources[r as ResourceType] ?? 0) >= (amt ?? 0),
  );
}

export function subtractCost(resources: Resources, cost: Partial<Resources>): Resources {
  const r = { ...resources };
  for (const [key, amt] of Object.entries(cost)) {
    r[key as ResourceType] -= amt ?? 0;
  }
  return r;
}

// ─── Turn processing ──────────────────────────────────────────────────────────

export function harvestResources(duchy: Duchy, map: WorldMap): Resources {
  const gained: Partial<Resources> = {};

  // Buildings produce all resources — tile resources removed
  for (const building of duchy.buildings) {
    const yields = BUILDING_YIELDS[building.type];
    for (const [r, amt] of Object.entries(yields)) {
      gained[r as ResourceType] = (gained[r as ResourceType] ?? 0) + (amt ?? 0) * building.level;
    }
  }

  const result = { ...duchy.resources };
  for (const [key, amt] of Object.entries(gained)) {
    result[key as ResourceType] += amt ?? 0;
  }
  return result;
}

// ─── King demands ─────────────────────────────────────────────────────────────

const DEMAND_RESOURCES: ResourceType[] = ['grain', 'timber', 'ore', 'cloth', 'gold'];

export function generateKingDemand(turnNumber: number): KingDemand {
  const resource = DEMAND_RESOURCES[Math.floor(turnNumber / 5) % DEMAND_RESOURCES.length];
  const amount = 5 + Math.floor(turnNumber / 5) * 3;
  return {
    id: `demand-${turnNumber}`,
    issuedTurn: turnNumber,
    deadlineTurn: turnNumber + 2,
    resourceType: resource,
    amount,
    favorReward: 10,
    favorPenalty: 20,
  };
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

export function findAdjacentUnclaimedTile(
  tiles: { x: number; y: number }[],
  map: WorldMap,
): { x: number; y: number } | null {
  const owned = new Set(tiles.map(t => `${t.x},${t.y}`));
  const seen = new Set<string>();
  const candidates: { x: number; y: number }[] = [];

  for (const { x, y } of tiles) {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as [number, number][]) {
      const nx = x + dx, ny = y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      if (owned.has(key) || seen.has(key)) continue;
      seen.add(key);
      const tile = map.tiles[ny]?.[nx];
      if (!tile || tile.type === 'ocean' || tile.duchyId !== null) continue;
      candidates.push({ x: nx, y: ny });
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function findStartingTile(map: WorldMap): { x: number; y: number } {
  const cx = Math.floor(map.width / 2);
  const cy = Math.floor(map.height / 2);
  for (let r = 0; r < 25; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
        const tile = map.tiles[y][x];
        if (tile.type === 'plains') return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}
