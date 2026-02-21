import type { Tile } from '../../types';

export type RiverPath = Array<{ x: number; y: number }>;

const MAX_RIVERS = 5;
const MIN_RIVER_LENGTH = 5;
const MAX_STEPS = 200;

/**
 * Generates river paths from high-elevation tiles flowing downhill to ocean/coast.
 * Uses the worldgen seeded RNG so rivers are reproducible per world seed.
 */
export function generateRivers(
  tiles: Tile[][],
  width: number,
  height: number,
  rng: () => number,
): RiverPath[] {
  // Collect mountain/high-elevation tiles away from the edge as candidate sources
  const candidates: { x: number; y: number }[] = [];
  for (let y = 4; y < height - 4; y++) {
    for (let x = 4; x < width - 4; x++) {
      if (tiles[y][x].elevation > 0.68 && tiles[y][x].type !== 'ocean') {
        candidates.push({ x, y });
      }
    }
  }

  // Sort highest elevation first so rivers start from peaks
  candidates.sort((a, b) => tiles[b.y][b.x].elevation - tiles[a.y][a.x].elevation);

  const rivers: RiverPath[] = [];
  // Blacklist tiles that are too close to an existing river (prevents parallel rivers)
  const blacklist = new Set<string>();

  for (const source of candidates) {
    if (rivers.length >= MAX_RIVERS) break;
    if (blacklist.has(`${source.x},${source.y}`)) continue;

    const path = flowDownhill(tiles, width, height, source, blacklist, rng);
    if (path.length >= MIN_RIVER_LENGTH) {
      rivers.push(path);
      // Blacklist a corridor around this river
      for (const p of path) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            blacklist.add(`${p.x + dx},${p.y + dy}`);
          }
        }
      }
    }
  }

  return rivers;
}

function flowDownhill(
  tiles: Tile[][],
  width: number,
  height: number,
  source: { x: number; y: number },
  blacklist: Set<string>,
  rng: () => number,
): RiverPath {
  const path: RiverPath = [{ ...source }];
  const visited = new Set<string>([`${source.x},${source.y}`]);

  let cx = source.x;
  let cy = source.y;

  for (let step = 0; step < MAX_STEPS; step++) {
    // Reached water — river complete
    const cur = tiles[cy][cx];
    if (cur.type === 'ocean' || cur.type === 'coast') break;

    const neighbors = [
      { x: cx,     y: cy - 1 },
      { x: cx,     y: cy + 1 },
      { x: cx - 1, y: cy     },
      { x: cx + 1, y: cy     },
    ].filter(n =>
      n.x >= 0 && n.x < width &&
      n.y >= 0 && n.y < height &&
      !visited.has(`${n.x},${n.y}`) &&
      !blacklist.has(`${n.x},${n.y}`),
    );

    if (neighbors.length === 0) break;

    // Sort by elevation ascending (always prefer going downhill)
    neighbors.sort((a, b) => tiles[a.y][a.x].elevation - tiles[b.y][b.x].elevation);

    // Small chance to take the second-lowest instead, for a natural meander
    const idx = neighbors.length > 1 && rng() < 0.2 ? 1 : 0;
    const next = neighbors[idx];

    visited.add(`${next.x},${next.y}`);
    path.push({ ...next });
    cx = next.x;
    cy = next.y;
  }

  return path;
}
