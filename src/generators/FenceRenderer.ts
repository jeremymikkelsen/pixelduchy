/**
 * FenceRenderer — post-and-rail fence following Voronoi cell polygon edges.
 *
 * For each pasture region:
 *   - Walk the half-edge ring to enumerate Voronoi polygon edges
 *   - Skip any edge whose neighbour is also a pasture (shared border = no fence)
 *   - Draw a 3px-tall post at each exterior vertex
 *   - Draw a single-pixel rail at height 1 along each exterior edge (Bresenham)
 *
 * Fence pixels are clipped to source-space pixels that belong to the pasture
 * region or its immediate neighbour region, preventing lines from straying
 * outside the actual rendered tile boundary.
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

function triOfEdge(e: number)  { return Math.floor(e / 3); }
function prevEdge(e: number)   { return (e % 3 === 0) ? e + 2 : e - 1; }

export class FenceRenderer {
  render(
    pixels: Uint32Array,
    pastures: PastureData[],
    topo: TopographyGenerator,
    improvements: Map<number, AgImprovementType>,
    ext: Int16Array | null,
    N: number,
    regionGrid: Uint16Array | null,
  ): { fencePixels: { idx: number; color: number }[] } {
    const fencePixels: { idx: number; color: number }[] = [];
    const scale = topo.size / N;
    const { mesh } = topo;
    const { delaunay, triCenters } = mesh;
    const halfedges = delaunay.halfedges;
    const triangles = delaunay.triangles;
    const numEdges  = mesh.numEdges;

    for (const pd of pastures) {
      const r = pd.regionIndex;

      // Linear scan over all half-edges — avoids the ring-traversal break on hull edges.
      // For each half-edge e whose source vertex is r, the Voronoi edge runs from
      // the circumcenter of triOfEdge(e) to the circumcenter of triOfEdge(halfedges[prevEdge(e)]).
      for (let e = 0; e < numEdges; e++) {
        if (triangles[e] !== r) continue;

        const fromTri  = triOfEdge(e);
        const prev     = prevEdge(e);
        const neighbor = triangles[prev];   // region across this Voronoi edge
        const opp      = halfedges[prev];

        // Only draw fence on exterior edges (neighbour is not a pasture)
        if (improvements.get(neighbor) === 'pasture') continue;

        const x0 = Math.round(triCenters[fromTri].x / scale);
        const y0 = Math.round(triCenters[fromTri].y / scale);

        if (opp === -1) {
          // Hull edge — no circumcenter on the other side.
          // Use the midpoint between the two region centers as the endpoint
          // so the fence still closes along the hull boundary.
          const pA = topo.mesh.points[r];
          const pB = topo.mesh.points[neighbor];
          const mx = Math.round(((pA.x + pB.x) / 2) / scale);
          const my = Math.round(((pA.y + pB.y) / 2) / scale);
          if (this._inBounds(x0, y0, N) || this._inBounds(mx, my, N)) {
            this._post(pixels, x0, y0, N, ext, fencePixels, regionGrid, r, neighbor);
            this._post(pixels, mx, my, N, ext, fencePixels, regionGrid, r, neighbor);
            this._rail(pixels, x0, y0, mx, my, N, ext, fencePixels, regionGrid, r, neighbor);
          }
        } else {
          const toTri = triOfEdge(opp);
          const x1 = Math.round(triCenters[toTri].x  / scale);
          const y1 = Math.round(triCenters[toTri].y  / scale);
          if (this._inBounds(x0, y0, N) || this._inBounds(x1, y1, N)) {
            this._post(pixels, x0, y0, N, ext, fencePixels, regionGrid, r, neighbor);
            this._post(pixels, x1, y1, N, ext, fencePixels, regionGrid, r, neighbor);
            this._rail(pixels, x0, y0, x1, y1, N, ext, fencePixels, regionGrid, r, neighbor);
          }
        }
      }
    }

    return { fencePixels };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _inBounds(px: number, py: number, N: number): boolean {
    return px >= 0 && px < N && py >= 0 && py < N;
  }

  /** 3-pixel tall post at source position (px, py), growing upward. */
  private _post(
    pixels: Uint32Array,
    px: number, py: number,
    N: number, ext: Int16Array | null,
    cap: { idx: number; color: number }[],
    regionGrid: Uint16Array | null,
    r1: number, _r2: number,
  ): void {
    const cx = Math.max(0, Math.min(N - 1, px));
    const cy = Math.max(0, Math.min(N - 1, py));

    // Clip: draw on pixels near the pasture boundary.
    // Allow pasture's own region + immediate neighbor, but also allow
    // pixels within 2px of a pasture pixel (for coastal/water edges).
    if (regionGrid) {
      const pr = regionGrid[cy * N + cx];
      if (pr !== r1 && pr !== _r2) {
        // Check if any adjacent pixel belongs to the pasture
        let nearPasture = false;
        for (let dy = -2; dy <= 2 && !nearPasture; dy++) {
          for (let dx = -2; dx <= 2 && !nearPasture; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < N && ny >= 0 && ny < N && regionGrid[ny * N + nx] === r1) {
              nearPasture = true;
            }
          }
        }
        if (!nearPasture) return;
      }
    }

    const base = this._sBase(cy * N + cx, cy, ext);
    for (let h = 0; h < 3; h++) {
      const sy = base - h;
      if (sy < 0 || sy >= N) continue;
      const si = sy * N + cx;
      cap.push({ idx: si, color: FENCE_POST });
      pixels[si] = FENCE_POST;
    }
  }

  /** Bresenham line; rail + intermediate posts every POST_INTERVAL steps. */
  private _rail(
    pixels: Uint32Array,
    x0: number, y0: number, x1: number, y1: number,
    N: number, ext: Int16Array | null,
    cap: { idx: number; color: number }[],
    regionGrid: Uint16Array | null,
    r1: number, r2: number,
  ): void {
    let cx = Math.round(x0), cy = Math.round(y0);
    const ex = Math.round(x1), ey = Math.round(y1);
    const dx = Math.abs(ex - cx), dy = Math.abs(ey - cy);
    const sx = cx < ex ? 1 : -1;
    const sy = cy < ey ? 1 : -1;
    let err = dx - dy;
    let step = 0;
    const POST_INTERVAL = 8;  // intermediate post every 8 Bresenham steps

    for (;;) {
      if (cx >= 0 && cx < N && cy >= 0 && cy < N) {
        // Draw on pixels near the pasture boundary
        const srcIdx = cy * N + cx;
        const pr = regionGrid ? regionGrid[srcIdx] : r1;
        let inRegion = (pr === r1 || pr === r2);
        // For water/coast edges, allow drawing near the pasture boundary
        if (!inRegion && regionGrid) {
          for (let ady = -2; ady <= 2 && !inRegion; ady++) {
            for (let adx = -2; adx <= 2 && !inRegion; adx++) {
              const nx = cx + adx, ny = cy + ady;
              if (nx >= 0 && nx < N && ny >= 0 && ny < N && regionGrid[ny * N + nx] === r1) {
                inRegion = true;
              }
            }
          }
        }
        if (inRegion) {
          const base = this._sBase(srcIdx, cy, ext);
          if (step > 0 && step % POST_INTERVAL === 0) {
            // Intermediate post — 3px tall, sitting on rail height
            for (let h = 0; h < 3; h++) {
              const psy = base - h;
              if (psy >= 0 && psy < N) {
                const pi = psy * N + cx;
                cap.push({ idx: pi, color: FENCE_POST });
                pixels[pi] = FENCE_POST;
              }
            }
          } else {
            const screenY = base - 1;
            if (screenY >= 0 && screenY < N) {
              const si = screenY * N + cx;
              cap.push({ idx: si, color: FENCE_RAIL });
              pixels[si] = FENCE_RAIL;
            }
          }
        }
      }
      if (cx === ex && cy === ey) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 <  dx) { err += dx; cy += sy; }
      step++;
    }
  }

  private _sBase(srcIdx: number, py: number, ext: Int16Array | null): number {
    return ext ? py - ext[srcIdx] : py;
  }
}
