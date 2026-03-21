/**
 * PlacedBuildingRenderer — renders player-placed buildings on the map.
 *
 * Buildings under construction show wooden scaffolding.
 * Completed buildings show a small 3/4-perspective structure.
 *
 * Rendered once per season during _renderMapInner, before trees.
 */

import { TopographyGenerator } from './TopographyGenerator';
import { packABGR, applyBrightness } from './TerrainPalettes';
import { Season } from '../state/Season';
import { BUILDING_DEFS, type BuildingInstance } from '../state/Building';

// ── Cell types ──────────────────────────────────────────────────────────────
const _ = 0;   // transparent
const W = 1;   // wall (wood)
const R = 2;   // roof
const D = 3;   // door
const S = 4;   // stone foundation
const N = 5;   // window
const P = 6;   // scaffolding pole
const X = 7;   // scaffolding cross-brace
const B = 8;   // scaffolding board/platform
const F = 9;   // flag/banner on top

// ── Scaffolding sprite (9×10, under construction) ────────────────────────
type SpriteTemplate = { w: number; h: number; data: number[]; anchorY: number };

const SCAFFOLD: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, F, _, _, _, _, _,
    _, _, P, X, P, _, _, _, _,
    _, _, P, B, P, _, _, _, _,
    _, P, X, B, X, P, _, _, _,
    _, P, B, B, B, P, _, _, _,
    _, P, X, B, X, P, _, _, _,
    _, P, B, B, B, P, _, _, _,
    _, S, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ── Generic building sprite (9×10, 3/4 perspective) ─────────────────────
const BUILDING_SPRITE: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, _, _,
    _, W, W, N, W, W, W, _, _,
    _, W, W, D, W, W, W, _, _,
    _, S, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ── Color palettes ──────────────────────────────────────────────────────
interface BuildingPalette {
  wall: number[];     // RGB hex, 2 shades
  roof: number[];     // 2 shades
  stone: number[];    // 2 shades
  door: number;
  window: number;
}

interface ScaffoldPalette {
  pole: number[];     // 2 shades
  brace: number[];    // 2 shades
  board: number[];    // 2 shades
  stone: number[];    // 2 shades
  flag: number;
}

const BUILDING_PALETTE_SUMMER: BuildingPalette = {
  wall:   [0x4a3520, 0x5c4430],
  roof:   [0x8a6040, 0x9c7250],
  stone:  [0x585050, 0x686060],
  door:   0x3a2810,
  window: 0x4488bb,
};

const BUILDING_PALETTE_WINTER: BuildingPalette = {
  wall:   [0x5a4530, 0x6c5440],
  roof:   [0xb0b0b8, 0xc0c0c8],
  stone:  [0x686068, 0x787078],
  door:   0x4a3820,
  window: 0x3a78a8,
};

const SCAFFOLD_PALETTE_SUMMER: ScaffoldPalette = {
  pole:  [0x6a5a30, 0x7c6c40],
  brace: [0x5a4a28, 0x6c5c38],
  board: [0x8a7a48, 0x9c8c58],
  stone: [0x585050, 0x686060],
  flag:  0xcc3333,
};

const SCAFFOLD_PALETTE_WINTER: ScaffoldPalette = {
  pole:  [0x7a6a40, 0x8c7c50],
  brace: [0x6a5a38, 0x7c6c48],
  board: [0x9a8a58, 0xac9c68],
  stone: [0x686068, 0x787078],
  flag:  0xcc4444,
};

// ── Renderer ────────────────────────────────────────────────────────────
export class PlacedBuildingRenderer {
  render(
    pixels: Uint32Array,
    resolution: number,
    topo: TopographyGenerator,
    buildings: BuildingInstance[],
    season: Season,
  ): { mask: Uint8Array; buildingMask: Uint8Array } {
    const NN = resolution;
    const scale = topo.size / NN;
    const points = topo.mesh.points;
    const mask = new Uint8Array(NN * NN);           // wide clearing
    const buildingMask = new Uint8Array(NN * NN);   // tight structure pixels

    const bPal = season === Season.Winter ? BUILDING_PALETTE_WINTER : BUILDING_PALETTE_SUMMER;
    const sPal = season === Season.Winter ? SCAFFOLD_PALETTE_WINTER : SCAFFOLD_PALETTE_SUMMER;

    for (const building of buildings) {
      const pt = points[building.region];
      if (!pt) continue;

      const cx = Math.floor(pt.x / scale);
      const cy = Math.floor(pt.y / scale);

      // Skip if too close to edge
      if (cx < 15 || cy < 15 || cx >= NN - 15 || cy >= NN - 15) continue;

      // Clear area around building (tree avoidance)
      const clearRadius = 10;
      for (let dy = -clearRadius; dy <= clearRadius; dy++) {
        for (let dx = -clearRadius; dx <= clearRadius; dx++) {
          if (dx * dx + dy * dy > clearRadius * clearRadius) continue;
          const px = cx + dx;
          const py = cy + dy;
          if (px >= 0 && px < NN && py >= 0 && py < NN) {
            mask[py * NN + px] = 1;
          }
        }
      }

      if (building.constructing) {
        this._stampShadow(pixels, NN, cx, cy, SCAFFOLD);
        this._stampScaffold(pixels, NN, cx, cy, SCAFFOLD, sPal, buildingMask);
      } else {
        this._stampShadow(pixels, NN, cx, cy, BUILDING_SPRITE);
        this._stampBuilding(pixels, NN, cx, cy, BUILDING_SPRITE, bPal, buildingMask, building);
      }
    }

    return { mask, buildingMask };
  }

  private _stampShadow(
    pixels: Uint32Array, N: number,
    cx: number, cy: number, sprite: SpriteTemplate,
  ): void {
    const halfW = Math.floor(sprite.w / 2);
    const shadowColor = packABGR(0, 0, 0); // will blend
    for (let row = 0; row < sprite.h; row++) {
      for (let col = 0; col < sprite.w; col++) {
        const cell = sprite.data[row * sprite.w + col];
        if (cell === _) continue;
        // Shadow offset: 1px right, 1px down
        const px = cx - halfW + col + 1;
        const py = cy - sprite.anchorY + row + 1;
        if (px < 0 || px >= N || py < 0 || py >= N) continue;
        const idx = py * N + px;
        // Darken existing pixel by 40%
        const existing = pixels[idx];
        const er = ((existing) & 0xff);
        const eg = ((existing >> 8) & 0xff);
        const eb = ((existing >> 16) & 0xff);
        pixels[idx] = packABGR(
          Math.floor(er * 0.6),
          Math.floor(eg * 0.6),
          Math.floor(eb * 0.6),
        );
      }
    }
  }

  private _stampScaffold(
    pixels: Uint32Array, NN: number,
    cx: number, cy: number,
    sprite: SpriteTemplate, pal: ScaffoldPalette,
    buildMask: Uint8Array,
  ): void {
    const halfW = Math.floor(sprite.w / 2);
    for (let row = 0; row < sprite.h; row++) {
      for (let col = 0; col < sprite.w; col++) {
        const cell = sprite.data[row * sprite.w + col];
        if (cell === _) continue;
        const px = cx - halfW + col;
        const py = cy - sprite.anchorY + row;
        if (px < 0 || px >= NN || py < 0 || py >= NN) continue;
        const idx = py * NN + px;
        const shade = (col + row) & 1; // dither
        let color: number;
        switch (cell) {
          case P: color = applyBrightness(pal.pole[shade], 1.0); break;
          case X: color = applyBrightness(pal.brace[shade], 1.0); break;
          case B: color = applyBrightness(pal.board[shade], 1.0); break;
          case S: color = applyBrightness(pal.stone[shade], 1.0); break;
          case F: color = applyBrightness(pal.flag, 1.0); break;
          default: continue;
        }
        pixels[idx] = color;
        buildMask[idx] = 1;
      }
    }
  }

  private _stampBuilding(
    pixels: Uint32Array, NN: number,
    cx: number, cy: number,
    sprite: SpriteTemplate, pal: BuildingPalette,
    buildMask: Uint8Array,
    building: BuildingInstance,
  ): void {
    const halfW = Math.floor(sprite.w / 2);
    // Use building-specific roof color tint based on category
    const def = BUILDING_DEFS[building.type];
    const catTints: Record<string, number> = {
      food_production:    0x7a9a40,  // green-ish
      food_processing:    0x8a7040,  // brown-ish
      resource_production: 0x6a7a50, // muted green
      processing:         0x8a5030,  // warm red-brown
      economic:           0x9a8a40,  // gold-ish
      military:           0x6a5050,  // dark red-gray
      social:             0x7a7a8a,  // blue-gray
      residential:        0x8a7a50,  // warm tan
    };
    const roofBase = catTints[def.category] ?? pal.roof[0];

    for (let row = 0; row < sprite.h; row++) {
      for (let col = 0; col < sprite.w; col++) {
        const cell = sprite.data[row * sprite.w + col];
        if (cell === _) continue;
        const px = cx - halfW + col;
        const py = cy - sprite.anchorY + row;
        if (px < 0 || px >= NN || py < 0 || py >= NN) continue;
        const idx = py * NN + px;
        const shade = (col + row) & 1;
        let color: number;
        switch (cell) {
          case W: color = applyBrightness(pal.wall[shade], 1.0); break;
          case R: color = applyBrightness(roofBase, shade ? 1.0 : 0.85); break;
          case D: color = applyBrightness(pal.door, 1.0); break;
          case N: color = applyBrightness(pal.window, 1.0); break;
          case S: color = applyBrightness(pal.stone[shade], 1.0); break;
          default: continue;
        }
        pixels[idx] = color;
        buildMask[idx] = 1;
      }
    }
  }
}
