import type { BuildingType, Duchy, KingDemand, ResourceType, Resources, WorldMap } from '../../types';

// ─── Building data ────────────────────────────────────────────────────────────

export const BUILDING_COSTS: Record<BuildingType, Partial<Resources>> = {
  mill:     { grain: 5, timber: 3 },
  mine:     { timber: 4 },
  sawmill:  { timber: 3, grain: 2 },
  port:     { timber: 6 },
  barracks: { timber: 5, ore: 4 },
  market:   { gold: 3, cloth: 2 },
  church:   { timber: 4, gold: 2 },
  castle:   { timber: 8, ore: 6, gold: 4 },
};

export const BUILDING_YIELDS: Record<BuildingType, Partial<Resources>> = {
  mill:     { grain: 4 },
  mine:     { ore: 4 },
  sawmill:  { timber: 4 },
  port:     { fish: 3, gold: 1 },
  barracks: {},
  market:   { gold: 3 },
  church:   {},
  castle:   { gold: 2 },
};

/** Favor granted once on construction */
export const BUILDING_FAVOR: Record<BuildingType, number> = {
  mill: 0, mine: 0, sawmill: 0, port: 0,
  barracks: 0, market: 0, church: 3, castle: 0,
};

/** Short code shown on the map tile */
export const BUILDING_LABELS: Record<BuildingType, string> = {
  mill: 'MLI', mine: 'MNE', sawmill: 'SAW', port: 'PRT',
  barracks: 'BRK', market: 'MKT', church: 'CHR', castle: 'CST',
};

export const BUILDING_DESCRIPTIONS: Record<BuildingType, string> = {
  mill:     '+4 grain/turn',
  mine:     '+4 ore/turn',
  sawmill:  '+4 timber/turn',
  port:     '+3 fish, +1 gold/turn',
  barracks: '+10 military strength',
  market:   '+3 gold/turn',
  church:   '+3 favor on build',
  castle:   '+2 gold/turn',
};

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

  for (const { x, y } of duchy.tiles) {
    const tile = map.tiles[y]?.[x];
    if (tile?.resource && tile.resourceYield > 0) {
      gained[tile.resource] = (gained[tile.resource] ?? 0) + tile.resourceYield;
    }
  }

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
    turnNumber,
    resourceType: resource,
    amount,
    favorReward: 10,
    favorPenalty: 20,
    deadline: turnNumber,
  };
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

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
        if (tile.type === 'plains' || tile.type === 'forest') return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}
