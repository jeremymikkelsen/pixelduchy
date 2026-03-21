/**
 * PlacedBuildingRenderer — renders player-placed buildings on the map.
 *
 * Buildings under construction show wooden scaffolding.
 * Completed buildings show a unique per-type 3/4-perspective sprite.
 *
 * Rendered once per season during _renderMapInner, before trees.
 */

import { TopographyGenerator } from './TopographyGenerator';
import { packABGR, applyBrightness } from './TerrainPalettes';
import { Season } from '../state/Season';
import { BUILDING_DEFS, type BuildingInstance, type BuildingType } from '../state/Building';
import { SPECIALIZED_BUILDING_TYPES } from '../state/GameState';

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
const C = 10;  // crop / vegetation
const T = 11;  // chimney / tower / spire
const A = 12;  // awning / covering
const L = 13;  // fence / log / wood accent
const Q = 14;  // water / dock
const K = 15;  // smoke wisp
const G = 16;  // gold / sign accent

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

// ── Per-type building sprites (9×10, 3/4 perspective) ───────────────────

// Field — rows of crops with fence rail
const SPRITE_FIELD: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, L, L, L, L, L, L, L, _,
    _, C, _, C, _, C, _, C, _,
    _, C, _, C, _, C, _, C, _,
    _, _, _, _, _, _, _, _, _,
    _, C, _, C, _, C, _, C, _,
    _, C, _, C, _, C, _, C, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Pasture — fenced enclosure with grass tufts
const SPRITE_PASTURE: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, L, L, L, L, L, L, L, _,
    _, L, _, _, _, _, _, L, _,
    _, L, _, C, _, _, _, L, _,
    _, L, _, _, _, C, _, L, _,
    _, L, L, _, _, L, L, L, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Orchard — small tree canopies on trunks
const SPRITE_ORCHARD: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, C, C, _, C, C, _, _,
    _, _, C, C, _, C, C, _, _,
    _, _, _, W, _, _, W, _, _,
    _, C, C, _, _, C, C, _, _,
    _, C, C, _, _, C, C, _, _,
    _, _, W, _, _, _, W, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Fishery — small hut with pier + water
const SPRITE_FISHERY: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, _, _, _, _,
    _, _, W, N, W, _, _, _, _,
    _, _, W, D, W, _, _, _, _,
    _, _, S, S, S, L, L, _, _,
    _, _, _, _, _, _, L, _, _,
    _, _, _, _, _, _, Q, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Smokehouse — building with tall chimney + smoke
const SPRITE_SMOKEHOUSE: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, K, _, _,
    _, _, _, _, _, _, K, _, _,
    _, _, _, _, _, _, T, _, _,
    _, _, R, R, R, R, T, _, _,
    _, _, W, N, W, W, W, _, _,
    _, _, W, D, W, W, W, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Kitchen — wide building with small chimney
const SPRITE_KITCHEN: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, T, _, _, _,
    _, _, _, _, _, T, _, _, _,
    _, R, R, R, R, R, R, _, _,
    _, W, N, W, W, N, W, _, _,
    _, W, W, D, W, W, W, _, _,
    _, S, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Dairy — small barn shape
const SPRITE_DAIRY: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, R, _, _, _, _,
    _, _, _, R, R, R, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, W, N, W, _, _,
    _, _, W, W, D, W, W, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Bakery — building with chimney puff
const SPRITE_BAKERY: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, K, _, _, _, _,
    _, _, _, _, T, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, _, W, N, D, W, _, _, _,
    _, _, W, W, W, W, _, _, _,
    _, _, S, S, S, S, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Woodcutter — small hut with log pile
const SPRITE_WOODCUTTER: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, _, _, _, _,
    _, _, W, N, W, _, _, _, _,
    _, _, W, D, W, _, L, _, _,
    _, _, S, S, S, _, L, L, _,
    _, _, _, _, _, _, L, L, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Sawmill — building with saw blade accent + logs
const SPRITE_SAWMILL: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, _, W, N, W, W, _, _, _,
    _, _, W, D, W, W, _, _, _,
    _, _, S, S, S, S, _, _, _,
    _, _, _, L, L, L, L, _, _,
    _, _, _, L, L, L, L, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Mill — tall windmill
const SPRITE_MILL: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, R, _, _, _, _,
    _, _, _, R, R, A, _, _, _,
    _, _, A, _, R, _, A, _, _,
    _, _, _, _, R, _, _, _, _,
    _, _, _, R, R, R, _, _, _,
    _, _, _, W, N, W, _, _, _,
    _, _, _, W, D, W, _, _, _,
    _, _, _, S, S, S, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Mine — cave entrance in hillside
const SPRITE_MINE: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, S, S, S, _, _, _,
    _, _, S, S, S, S, S, _, _,
    _, S, S, _, _, _, S, S, _,
    _, S, _, _, _, _, _, S, _,
    _, S, S, L, L, L, S, S, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Quarry — open pit with stone blocks
const SPRITE_QUARRY: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, S, S, _, _, _, S, S, _,
    _, S, _, _, _, _, _, S, _,
    _, S, _, S, S, _, _, S, _,
    _, S, S, S, S, S, S, S, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Bog mine — low structure with dark pool
const SPRITE_BOG_MINE: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, _, _, _, _,
    _, _, W, D, W, _, _, _, _,
    _, _, S, S, S, _, _, _, _,
    _, _, _, Q, Q, Q, Q, _, _,
    _, _, _, Q, Q, Q, Q, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Smelter — building with large chimney + glow
const SPRITE_SMELTER: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, K, _, _, _,
    _, _, _, _, _, K, _, _, _,
    _, _, _, _, T, T, _, _, _,
    _, _, _, _, T, T, _, _, _,
    _, _, R, R, R, T, _, _, _,
    _, _, W, N, W, W, _, _, _,
    _, _, W, D, W, W, _, _, _,
    _, _, S, S, S, S, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Weaver — building with fabric/loom accent
const SPRITE_WEAVER: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, _, W, N, W, N, _, _, _,
    _, _, W, D, W, W, _, _, _,
    _, _, S, S, S, S, _, _, _,
    _, _, _, A, A, A, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Market — open stall with awning
const SPRITE_MARKET: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, A, A, A, A, A, A, _, _,
    _, A, A, A, A, A, A, _, _,
    _, L, _, _, _, _, L, _, _,
    _, L, G, G, G, G, L, _, _,
    _, S, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Port — wide warehouse on pier stilts
const SPRITE_PORT: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, R, R, R, R, R, R, R, _,
    _, R, R, R, R, R, R, R, _,
    _, W, N, W, D, W, N, W, _,
    _, L, _, L, _, L, _, L, _,
    _, Q, Q, Q, Q, Q, Q, Q, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Barracks — fortified with battlements
const SPRITE_BARRACKS: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, S, _, S, _, S, _, S, _,
    _, S, S, S, S, S, S, S, _,
    _, W, N, W, W, W, N, W, _,
    _, W, W, W, D, W, W, W, _,
    _, S, S, S, S, S, S, S, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Church — tall steeple with cross
const SPRITE_CHURCH: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, T, _, _, _, _,
    _, _, _, T, T, T, _, _, _,
    _, _, _, _, T, _, _, _, _,
    _, _, _, R, R, R, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, W, N, W, W, _, _,
    _, _, W, W, D, W, W, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Castle — wide with two towers and flags
const SPRITE_CASTLE: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, F, _, _, _, _, _, F, _,
    _, S, _, S, _, S, _, S, _,
    _, S, S, S, S, S, S, S, _,
    _, S, R, R, R, R, R, S, _,
    _, S, W, N, W, N, W, S, _,
    _, S, W, W, D, W, W, S, _,
    _, S, S, S, S, S, S, S, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// Tavern — building with hanging sign
const SPRITE_TAVERN: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, _, _,
    _, W, N, W, W, N, W, _, _,
    _, W, W, D, W, W, W, L, _,
    _, S, S, S, S, S, S, G, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// House — generic residential (fallback)
const SPRITE_HOUSE: SpriteTemplate = {
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

// ── Sprite lookup by building type ──────────────────────────────────────
const BUILDING_SPRITES: Record<BuildingType, SpriteTemplate> = {
  field:      SPRITE_FIELD,
  pasture:    SPRITE_PASTURE,
  orchard:    SPRITE_ORCHARD,
  fishery:    SPRITE_FISHERY,
  smokehouse: SPRITE_SMOKEHOUSE,
  kitchen:    SPRITE_KITCHEN,
  dairy:      SPRITE_DAIRY,
  bakery:     SPRITE_BAKERY,
  woodcutter: SPRITE_WOODCUTTER,
  sawmill:    SPRITE_SAWMILL,
  mill:       SPRITE_MILL,
  mine:       SPRITE_MINE,
  quarry:     SPRITE_QUARRY,
  bog_mine:   SPRITE_BOG_MINE,
  smelter:    SPRITE_SMELTER,
  weaver:     SPRITE_WEAVER,
  market:     SPRITE_MARKET,
  port:       SPRITE_PORT,
  barracks:   SPRITE_BARRACKS,
  church:     SPRITE_CHURCH,
  castle:     SPRITE_CASTLE,
  tavern:     SPRITE_TAVERN,
  house:      SPRITE_HOUSE,
};

// ── Color palettes ──────────────────────────────────────────────────────
interface BuildingPalette {
  wall: number[];     // RGB hex, 2 shades
  roof: number[];     // 2 shades
  stone: number[];    // 2 shades
  door: number;
  window: number;
  crop: number[];     // 2 shades (green)
  chimney: number[];  // 2 shades (dark stone)
  awning: number[];   // 2 shades (light warm)
  fence: number[];    // 2 shades (light wood)
  water: number[];    // 2 shades (blue)
  smoke: number[];    // 2 shades (gray)
  gold: number[];     // 2 shades (warm amber)
}

interface ScaffoldPalette {
  pole: number[];     // 2 shades
  brace: number[];    // 2 shades
  board: number[];    // 2 shades
  stone: number[];    // 2 shades
  flag: number;
}

const BUILDING_PALETTE_SUMMER: BuildingPalette = {
  wall:    [0x4a3520, 0x5c4430],
  roof:    [0x8a6040, 0x9c7250],
  stone:   [0x585050, 0x686060],
  door:    0x3a2810,
  window:  0x4488bb,
  crop:    [0x5a8a30, 0x6c9c40],
  chimney: [0x484040, 0x585050],
  awning:  [0xaa8850, 0xbc9a60],
  fence:   [0x7a6a40, 0x8c7c50],
  water:   [0x3a6888, 0x4a7898],
  smoke:   [0x909090, 0xa0a0a0],
  gold:    [0xaa8830, 0xbc9a40],
};

const BUILDING_PALETTE_WINTER: BuildingPalette = {
  wall:    [0x5a4530, 0x6c5440],
  roof:    [0xb0b0b8, 0xc0c0c8],
  stone:   [0x686068, 0x787078],
  door:    0x4a3820,
  window:  0x3a78a8,
  crop:    [0x708060, 0x809070],
  chimney: [0x585058, 0x686068],
  awning:  [0x9a8858, 0xac9a68],
  fence:   [0x8a7a50, 0x9c8c60],
  water:   [0x4a7090, 0x5a80a0],
  smoke:   [0xa0a0a8, 0xb0b0b8],
  gold:    [0x9a8838, 0xac9a48],
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
      // Skip completed buildings that are rendered by specialized renderers
      // (FarmRenderer, WoodcutterRenderer, etc.) — only show scaffold during construction
      if (!building.constructing && SPECIALIZED_BUILDING_TYPES.has(building.type)) continue;

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
        const sprite = BUILDING_SPRITES[building.type] ?? SPRITE_HOUSE;
        this._stampShadow(pixels, NN, cx, cy, sprite);
        this._stampBuilding(pixels, NN, cx, cy, sprite, bPal, buildingMask, building);
      }
    }

    return { mask, buildingMask };
  }

  private _stampShadow(
    pixels: Uint32Array, N: number,
    cx: number, cy: number, sprite: SpriteTemplate,
  ): void {
    const halfW = Math.floor(sprite.w / 2);
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
      food_production:     0x7a9a40,  // green-ish
      food_processing:     0x8a7040,  // brown-ish
      resource_production: 0x6a7a50,  // muted green
      processing:          0x8a5030,  // warm red-brown
      economic:            0x9a8a40,  // gold-ish
      military:            0x6a5050,  // dark red-gray
      social:              0x7a7a8a,  // blue-gray
      residential:         0x8a7a50,  // warm tan
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
          case C: color = applyBrightness(pal.crop[shade], 1.0); break;
          case T: color = applyBrightness(pal.chimney[shade], 1.0); break;
          case A: color = applyBrightness(pal.awning[shade], 1.0); break;
          case L: color = applyBrightness(pal.fence[shade], 1.0); break;
          case Q: color = applyBrightness(pal.water[shade], 1.0); break;
          case K: color = applyBrightness(pal.smoke[shade], 1.0); break;
          case G: color = applyBrightness(pal.gold[shade], 1.0); break;
          case F: color = applyBrightness(0xcc3333, 1.0); break;
          default: continue;
        }
        pixels[idx] = color;
        buildMask[idx] = 1;
      }
    }
  }
}
