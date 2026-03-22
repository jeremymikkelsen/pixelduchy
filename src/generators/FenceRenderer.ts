/**
 * FenceRenderer — post-and-rail fence following actual Voronoi cell edges.
 *
 * Scans the regionGrid to find boundary pixels where a pasture pixel
 * neighbors a non-pasture pixel. Draws fence posts and rails directly
 * on those boundary pixels, perfectly matching the visual cell edges.
 *
 * All fence pixels are returned in `fencePixels` for per-frame restoration
 * after cow animation, so cows never permanently erase fence segments.
 */

import { packABGR } from './TerrainPalettes';
import type { PastureData } from './FarmRenderer';
import type { TopographyGenerator } from './TopographyGenerator';
import type { AgImprovementType } from '../state/AgImprovements';

const FENCE_POST = packABGR(0x4c, 0x32, 0x18);
const FENCE_RAIL = packABGR(0x6e, 0x4c, 0x26);

export class FenceRenderer {
  render(
    pixels: Uint32Array,
    pastures: PastureData[],
    _topo: TopographyGenerator,
    improvements: Map<number, AgImprovementType>,
    ext: Int16Array | null,
    N: number,
    regionGrid: Uint16Array | null,
  ): { fencePixels: { idx: number; color: number }[] } {
    const fencePixels: { idx: number; color: number }[] = [];
    if (!regionGrid) return { fencePixels };

    // Build set of all pasture regions for shared-border detection
    const pastureRegions = new Set<number>();
    for (const pd of pastures) {
      pastureRegions.add(pd.regionIndex);
    }

    // For each pasture, find boundary pixels and draw fence
    for (const pd of pastures) {
      const r = pd.regionIndex;

      // Scan region bounding box for boundary pixels
      const { minX, maxX, minY, maxY } = pd;
      // Expand bounds by 1 to catch edge pixels
      const x0 = Math.max(0, minX - 1);
      const x1 = Math.min(N - 1, maxX + 1);
      const y0 = Math.max(0, minY - 1);
      const y1 = Math.min(N - 1, maxY + 1);

      // Use a seeded counter for post spacing
      let boundaryCount = 0;

      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const idx = py * N + px;
          if (regionGrid[idx] !== r) continue;

          // Check if this pixel borders a non-pasture region
          let isBoundary = false;
          // Check 4-connected neighbors
          if (px > 0     && regionGrid[idx - 1] !== r && !pastureRegions.has(regionGrid[idx - 1])) isBoundary = true;
          if (px < N - 1 && regionGrid[idx + 1] !== r && !pastureRegions.has(regionGrid[idx + 1])) isBoundary = true;
          if (py > 0     && regionGrid[idx - N] !== r && !pastureRegions.has(regionGrid[idx - N])) isBoundary = true;
          if (py < N - 1 && regionGrid[idx + N] !== r && !pastureRegions.has(regionGrid[idx + N])) isBoundary = true;

          if (!isBoundary) continue;

          // Draw fence at this boundary pixel
          const base = ext ? py - ext[idx] : py;

          if (boundaryCount % 8 === 0) {
            // Post — 3px tall
            for (let h = 0; h < 3; h++) {
              const sy = base - h;
              if (sy >= 0 && sy < N) {
                const si = sy * N + px;
                fencePixels.push({ idx: si, color: FENCE_POST });
                pixels[si] = FENCE_POST;
              }
            }
          } else {
            // Rail — 1px at height 1
            const sy = base - 1;
            if (sy >= 0 && sy < N) {
              const si = sy * N + px;
              fencePixels.push({ idx: si, color: FENCE_RAIL });
              pixels[si] = FENCE_RAIL;
            }
          }
          boundaryCount++;
        }
      }
    }

    return { fencePixels };
  }
}
