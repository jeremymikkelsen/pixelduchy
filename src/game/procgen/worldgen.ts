import type { WorldMap, Tile, TileType } from '../../types';
import { generateRivers } from './rivergen';

interface WorldGenOptions {
  width: number;
  height: number;
  seed: number;
}

// ─── Seeded PRNG (mulberry32) ─────────────────────────────────────────────────

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Simple value noise ───────────────────────────────────────────────────────

function valueNoise(width: number, height: number, rng: () => number, scale: number): number[][] {
  const grid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => rng()),
  );

  // Bilinear interpolation upsampling
  const result: number[][] = [];
  for (let y = 0; y < height; y++) {
    result.push([]);
    for (let x = 0; x < width; x++) {
      const gx = (x / width) * scale;
      const gy = (y / height) * scale;
      const x0 = Math.floor(gx) % scale;
      const y0 = Math.floor(gy) % scale;
      const x1 = (x0 + 1) % scale;
      const y1 = (y0 + 1) % scale;
      const fx = gx - Math.floor(gx);
      const fy = gy - Math.floor(gy);
      const gh = Math.floor(height / scale) || 1;
      const gw = Math.floor(width / scale) || 1;
      const v00 = grid[Math.min(y0 * gh, height - 1)][Math.min(x0 * gw, width - 1)];
      const v10 = grid[Math.min(y0 * gh, height - 1)][Math.min(x1 * gw, width - 1)];
      const v01 = grid[Math.min(y1 * gh, height - 1)][Math.min(x0 * gw, width - 1)];
      const v11 = grid[Math.min(y1 * gh, height - 1)][Math.min(x1 * gw, width - 1)];
      result[y][x] = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
    }
  }
  return result;
}

// ─── Tile classification ──────────────────────────────────────────────────────

function classifyTile(elevation: number, moisture: number, distToEdge: number, mountainThreshold: number): TileType {
  // Quadratic falloff: suppresses elevation near edges → guaranteed ocean border,
  // single cohesive landmass, no inland seas.
  const falloff = Math.pow(1 - distToEdge, 2) * 1.2;
  const e = elevation - falloff;   // island-adjusted elevation

  if (e < 0.25) return 'ocean';    // covers distToEdge ≤ ~0.22 → always ocean
  if (e < 0.34) return 'coast';
  if (elevation > mountainThreshold) return 'mountain';
  if (moisture > 0.74) return 'wetland';
  if (moisture > 0.45) return 'forest';
  return 'plains';
}

/** Underlying biome that would exist here if mountains weren't a category.
 *  Used as the visual tile type so mountain peaks render over real terrain.
 *  Also determines mountain vs hill: plains → hill, forest/wetland → mountain. */
function classifyTileUnderlying(elevation: number, moisture: number, distToEdge: number): TileType {
  const falloff = Math.pow(1 - distToEdge, 2) * 1.2;
  const e = elevation - falloff;
  if (e < 0.25) return 'ocean';
  if (e < 0.34) return 'coast';
  // No mountain branch — fall through to moisture-based biome
  if (moisture > 0.74) return 'wetland';
  if (moisture > 0.45) return 'forest';
  return 'plains';
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateWorld({ width, height, seed }: WorldGenOptions): WorldMap {
  const rng = mulberry32(seed);

  // Two elevation octaves mixed together: large-scale base + fine-grain detail.
  const elevBase   = valueNoise(width, height, rng, 8);
  const elevDetail = valueNoise(width, height, rng, 16);
  const elevation  = elevBase.map((row, y) =>
    row.map((v, x) => Math.min(1, v * 0.72 + elevDetail[y][x] * 0.28))
  );
  const moisture  = valueNoise(width, height, rng, 6);

  // Cap mountains at ≤5% of total tiles: use the 95th-percentile elevation.
  const sortedElev = elevation.flat().sort((a, b) => a - b);
  const mountainThreshold = Math.max(0.72, sortedElev[Math.floor(sortedElev.length * 0.95)]);

  const tiles: Tile[][] = [];

  for (let y = 0; y < height; y++) {
    tiles.push([]);
    for (let x = 0; x < width; x++) {
      const nx = (2 * x) / width - 1;
      const ny = (2 * y) / height - 1;
      const distToEdge = 1 - Math.max(Math.abs(nx), Math.abs(ny));

      const e = elevation[y][x];
      const m = moisture[y][x];
      const type = classifyTile(e, m, distToEdge, mountainThreshold);
      const visualType = type === 'mountain'
        ? classifyTileUnderlying(e, m, distToEdge)
        : type;

      tiles[y].push({
        x,
        y,
        type,
        visualType,
        elevation: e,
        resource: null,
        resourceYield: 0,
        duchyId: null,
        wildlifeCapacity: 0,
        wildlifeCurrent: 0,
      });
    }
  }

  // Post-process: reclassify mountain tiles within Chebyshev distance 2 of coast/ocean.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].type !== 'mountain') continue;
      let tooClose = false;
      outer: for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const t = tiles[ny][nx].type;
          if (t === 'coast' || t === 'ocean') { tooClose = true; break outer; }
        }
      }
      if (!tooClose) continue;
      const newType: TileType = tiles[y][x].visualType ?? 'plains';
      tiles[y][x].type       = newType;
      tiles[y][x].visualType = newType;
    }
  }

  const rivers = generateRivers(tiles, width, height, rng);

  return { width, height, tiles, seed, rivers };
}
