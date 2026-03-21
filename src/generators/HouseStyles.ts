/**
 * HouseStyles — unique architectural templates and color palettes for each of the 9 houses.
 *
 * Each house has a completely distinct visual identity inspired by its cultural background:
 *   0 Aldren  — Anglo-Saxon farmstead (golden thatch, heavy timber)
 *   1 Mira    — Venetian merchant (terracotta tiles, white plaster)
 *   2 Sera    — Burgundian court (slate turrets, purple accents)
 *   3 Dorn    — Norse/Viking (sod roofs, red-stained wood, longhouse)
 *   4 Crell   — Byzantine intelligence (blue tiles, watchtower)
 *   5 Vael    — Celtic/Druidic (living green roofs, round wattle-daub)
 *   6 Orvyn   — Hanseatic/German (half-timber Fachwerk, dark slate)
 *   7 Varek   — Roman military (fortress stone, red tile, crenellations)
 *   8 Brynn   — Scottish Highland (broch tower, dry-stone, weathered slate)
 *
 * Sprite cell types match StructureRenderer conventions:
 *   0=transparent, 1=wall, 2=roof, 3=door, 4=stone, 5=window,
 *   6=porch, 7=chimney, 8=east/side wall, 9=smoke
 *
 * Additional cell types for house-specific features:
 *   10=banner/flag, 11=beam/timber frame, 12=turret cap, 13=crenellation
 */

import { Season } from '../state/Season';

// ---------------------------------------------------------------------------
// Cell type constants (matching StructureRenderer)
// ---------------------------------------------------------------------------
const _ = 0;   // transparent
const W = 1;   // wall (front face)
const R = 2;   // roof
const D = 3;   // door
const S = 4;   // stone foundation
const N = 5;   // window
const P = 6;   // porch / platform
const K = 7;   // chimney
const E = 8;   // east/side wall (3/4 depth)
const M = 9;   // smoke
const B = 10;  // banner/flag
const F = 11;  // timber frame / beam (half-timber houses)
const T = 12;  // turret cap / finial
const C = 13;  // crenellation / battlement

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type SpriteTemplate = { w: number; h: number; data: number[]; anchorY: number };

export interface HousePalette {
  wall: number[];     // 5 shades (front face, left-lit to right-dark)
  roof: number[];     // 5 shades (directional lighting)
  stone: number[];    // 5 shades (foundation)
  door: number;
  window: number;
  porch: number[];    // 3 shades
  chimney: number[];  // 3 shades
  sideWall: number;   // east/side wall color
  // Extended palette for house-specific features
  banner?: number;    // flag/banner color
  beam?: number;      // timber frame color
  turret?: number;    // turret cap color
  crenellation?: number; // battlement color
  accent?: number;    // general accent color
}

export interface HouseStyle {
  name: string;
  manorSmall: SpriteTemplate;
  manorMedium: SpriteTemplate;
  manorLarge: SpriteTemplate;
  cottageSmall: SpriteTemplate;
  cottageMedium: SpriteTemplate;
  productionHut: SpriteTemplate;  // base for woodcutter/fishing/etc
  palette: HousePalette;
  winterPalette: HousePalette;
  // Cultural variants
  cropStyle: 'wheat' | 'rice' | 'root_veg' | 'vine' | 'herb' | 'oat' | 'mixed' | 'barley' | 'rye';
  cattleColor: number[];  // [body, spots/accent, belly] RGB hex
  cattleName: string;     // flavor text
}

// ---------------------------------------------------------------------------
// Helper: winter palette from summer palette (snow on roof, muted tones)
// ---------------------------------------------------------------------------
function winterize(p: HousePalette): HousePalette {
  return {
    ...p,
    roof: [0xc8c8d0, 0xd4d4dc, 0xe0e0e8, 0xeaeaf0, 0xf4f4f8],
    porch: [0xb0b0b8, 0xc0c0c8, 0xd0d0d8],
    window: Math.max(0, p.window - 0x0a1010),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE 0: ALDREN — Anglo-Saxon Farmstead
// Heavy timber longhouse, steep golden thatch, granary legacy
// ═══════════════════════════════════════════════════════════════════════════
const ALDREN_PALETTE: HousePalette = {
  wall:    [0x3e2a14, 0x4e3820, 0x5e462c, 0x6e5438, 0x7e6244],
  roof:    [0x8a7530, 0x9c8840, 0xae9a50, 0xc0ac60, 0xd2be70],
  stone:   [0x504838, 0x605840, 0x706848, 0x807850, 0x908858],
  door:    0x2e1c08,
  window:  0x3a7898,
  porch:   [0x4a3820, 0x5e4c2e, 0x72603c],
  chimney: [0x706050, 0x807060, 0x908070],
  sideWall: 0x3e2a14,
};

const ALDREN_MANOR_SMALL: SpriteTemplate = {
  w: 13, h: 13, anchorY: 12, data: [
    _, _, _, _, M, _, _, _, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _, _, _, _, _,
    _, _, R, R, R, R, R, R, R, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, _, _, _,
    _, W, W, N, W, W, N, W, E, E, E, _, _,
    _, W, W, W, W, W, W, W, E, E, E, _, _,
    _, W, W, W, D, W, W, W, E, E, E, _, _,
    _, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, _, _, _, _, _,
  ],
};

const ALDREN_MANOR_MEDIUM: SpriteTemplate = {
  w: 16, h: 16, anchorY: 15, data: [
    _, _, _, _, _, M, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, K, M, _, _, _, _, _, _, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, _, _, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, W, W, N, W, W, N, W, W, N, W, E, E, E, _, _,
    _, W, W, W, W, W, W, W, W, W, W, E, E, E, _, _,
    _, W, W, W, W, D, W, W, W, W, W, E, E, E, _, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, _, _, _, _, _, _, _,
  ],
};

const ALDREN_MANOR_LARGE: SpriteTemplate = {
  w: 19, h: 18, anchorY: 17, data: [
    _, _, _, _, _, _, M, _, _, _, _, _, M, _, _, _, _, _, _,
    _, _, _, _, _, K, M, _, _, _, _, K, M, _, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, W, W, N, W, W, N, W, W, W, N, W, W, N, E, E, E, E, _,
    _, W, W, W, W, W, W, W, W, W, W, W, W, W, E, E, E, E, _,
    _, W, W, W, W, W, W, D, W, W, W, W, W, W, E, E, E, E, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, P, P, P, _, _, _, _, _, _, _, _,
  ],
};

const ALDREN_COTTAGE_SMALL: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, M, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, _, _,
    _, W, W, N, W, E, E, _, _,
    _, W, W, D, W, E, E, _, _,
    _, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, _, _, _,
    _, _, _, P, P, _, _, _, _,
  ],
};

const ALDREN_COTTAGE_MEDIUM: SpriteTemplate = {
  w: 10, h: 11, anchorY: 10, data: [
    _, _, _, _, M, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _, _,
    _, _, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, _, _,
    _, W, W, N, W, W, E, E, _, _,
    _, W, W, W, W, W, E, E, _, _,
    _, W, W, D, W, W, E, E, _, _,
    _, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, _, _, _, _,
  ],
};

const ALDREN_PRODUCTION_HUT: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, M, _, _, _, _, _,
    _, _, K, K, _, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, _, _,
    _, W, W, N, W, E, E, _, _,
    _, W, W, D, W, E, E, _, _,
    _, S, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE 1: MIRA — Venetian Merchant
// Terracotta tile roofs, whitewashed plaster walls, arched windows, balcony
// ═══════════════════════════════════════════════════════════════════════════
const MIRA_PALETTE: HousePalette = {
  wall:    [0xd8c8a0, 0xe0d0a8, 0xe8d8b0, 0xf0e0b8, 0xf8e8c0],
  roof:    [0x984020, 0xa84828, 0xb85030, 0xc85838, 0xd86040],
  stone:   [0xc0b088, 0xc8b890, 0xd0c098, 0xd8c8a0, 0xe0d0a8],
  door:    0x503018,
  window:  0x50a0d0,
  porch:   [0xc0a878, 0xc8b080, 0xd0b888],
  chimney: [0x986850, 0xa87860, 0xb88870],
  sideWall: 0xc8b890,
  accent:  0xc9a227,
};

const MIRA_MANOR_SMALL: SpriteTemplate = {
  w: 13, h: 14, anchorY: 13, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, K, _, _, _, _, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, R, R, R, _, _,
    _, _, W, N, W, N, W, N, W, E, E, _, _,
    _, _, W, W, W, W, W, W, W, E, E, _, _,
    _, _, W, N, W, N, W, N, W, E, E, _, _,
    _, _, W, W, W, D, W, W, W, E, E, _, _,
    _, _, S, S, S, S, S, S, S, S, S, _, _,
    _, _, _, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, P, _, _, _, _, _, _,
  ],
};

const MIRA_MANOR_MEDIUM: SpriteTemplate = {
  w: 16, h: 16, anchorY: 15, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, K, _, _, _, _, K, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, W, N, W, N, W, W, N, W, N, W, E, E, _, _,
    _, _, W, W, W, W, W, W, W, W, W, W, E, E, _, _,
    _, _, W, N, W, N, W, W, N, W, N, W, E, E, _, _,
    _, _, W, W, W, W, D, D, W, W, W, W, E, E, _, _,
    _, _, S, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _,
  ],
};

const MIRA_MANOR_LARGE: SpriteTemplate = {
  w: 19, h: 18, anchorY: 17, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, K, _, _, _, _, _, _, _, K, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, W, N, W, N, W, N, W, W, N, W, N, W, N, E, E, E, _,
    _, _, W, W, W, W, W, W, W, W, W, W, W, W, W, E, E, E, _,
    _, _, W, N, W, N, W, N, W, W, N, W, N, W, N, E, E, E, _,
    _, _, W, W, W, W, W, D, D, W, W, W, W, W, W, E, E, E, _,
    _, _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _, P, P, _, _, _, _, _, _, _, _,
  ],
};

const MIRA_COTTAGE_SMALL: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, W, N, E, _, _,
    _, _, W, W, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, P, P, P, _, _, _,
    _, _, _, _, P, _, _, _, _,
  ],
};

const MIRA_COTTAGE_MEDIUM: SpriteTemplate = {
  w: 10, h: 11, anchorY: 10, data: [
    _, _, _, _, _, _, _, _, _, _,
    _, _, _, K, _, _, _, _, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, _, W, N, W, N, W, E, _, _,
    _, _, W, W, W, W, W, E, _, _,
    _, _, W, W, D, W, W, E, _, _,
    _, _, S, S, S, S, S, S, _, _,
    _, _, _, P, P, P, P, _, _, _,
    _, _, _, _, P, P, _, _, _, _,
  ],
};

const MIRA_PRODUCTION_HUT: SpriteTemplate = {
  w: 9, h: 9, anchorY: 8, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, K, _, _, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, W, N, E, _, _,
    _, _, W, W, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, P, P, P, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE 2: SERA — Burgundian Court
// Pointed turrets, steep slate roof, elegant stone, purple accents
// ═══════════════════════════════════════════════════════════════════════════
const SERA_PALETTE: HousePalette = {
  wall:    [0xc8b898, 0xd0c0a0, 0xd8c8a8, 0xe0d0b0, 0xe8d8b8],
  roof:    [0x483858, 0x584868, 0x685878, 0x786888, 0x887898],
  stone:   [0xb0a088, 0xb8a890, 0xc0b098, 0xc8b8a0, 0xd0c0a8],
  door:    0x402818,
  window:  0x6888c0,
  porch:   [0xa89878, 0xb0a080, 0xb8a888],
  chimney: [0x585060, 0x686070, 0x787080],
  sideWall: 0xc0b090,
  turret:  0x7b4fa6,
  banner:  0x7b4fa6,
};

const SERA_MANOR_SMALL: SpriteTemplate = {
  w: 14, h: 15, anchorY: 14, data: [
    _, _, _, _, _, _, _, _, _, _, _, T, _, _,
    _, _, _, _, M, _, _, _, _, _, T, R, T, _,
    _, _, _, K, M, _, _, _, _, _, _, R, _, _,
    _, _, _, R, R, R, R, R, R, _, _, R, _, _,
    _, _, R, R, R, R, R, R, R, R, _, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, W, W, N, W, W, N, W, W, E, E, E, _, _,
    _, W, W, W, W, W, W, W, W, E, E, E, _, _,
    _, W, W, W, D, W, W, W, W, E, E, E, _, _,
    _, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, P, P, P, _, _, _, _, _, _,
  ],
};

const SERA_MANOR_MEDIUM: SpriteTemplate = {
  w: 17, h: 17, anchorY: 16, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, T, _, _, _,
    _, _, _, _, _, M, _, _, _, _, _, _, T, R, T, _, _,
    _, _, _, _, K, M, _, _, _, _, _, _, _, R, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, _, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, W, W, N, W, W, N, W, W, N, W, W, E, E, E, _, _,
    _, W, W, W, W, W, W, W, W, W, W, W, E, E, E, _, _,
    _, W, W, W, W, W, D, W, W, W, W, W, E, E, E, _, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _, _,
  ],
};

const SERA_MANOR_LARGE: SpriteTemplate = {
  w: 20, h: 19, anchorY: 18, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, T, _, _, _,
    _, _, _, _, _, _, M, _, _, _, _, _, _, _, _, T, R, T, _, _,
    _, _, _, _, _, K, M, _, _, _, _, _, _, _, _, _, R, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, R, R, R, _, R, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, W, W, N, W, W, N, W, W, N, W, W, N, W, W, E, E, E, E, _,
    _, W, W, W, W, W, W, W, W, W, W, W, W, W, W, E, E, E, E, _,
    _, W, W, W, W, W, W, W, D, W, W, W, W, W, W, E, E, E, E, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _, _, _,
  ],
};

const SERA_COTTAGE_SMALL: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, R, R, R, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, _,
    _, W, W, N, W, W, E, E, _,
    _, W, W, D, W, W, E, E, _,
    _, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, _, _,
    _, _, _, P, P, P, _, _, _,
  ],
};

const SERA_COTTAGE_MEDIUM: SpriteTemplate = {
  w: 10, h: 12, anchorY: 11, data: [
    _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, K, _, _, _, _, _,
    _, _, _, _, R, R, _, _, _, _,
    _, _, _, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, _,
    _, W, W, N, W, W, N, E, E, _,
    _, W, W, W, W, W, W, E, E, _,
    _, W, W, W, D, W, W, E, E, _,
    _, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, _, _, _,
  ],
};

const SERA_PRODUCTION_HUT: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, K, _, _, _, _, _,
    _, _, _, R, R, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, _, _,
    _, W, W, N, W, E, E, _, _,
    _, W, W, D, W, E, E, _, _,
    _, S, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE 3: DORN — Norse/Viking
// Longhouse with dragon-prow ridge, sod/turf roof, red-stained wood
// ═══════════════════════════════════════════════════════════════════════════
const DORN_PALETTE: HousePalette = {
  wall:    [0x6a2018, 0x7a2820, 0x8a3028, 0x9a3830, 0xaa4038],
  roof:    [0x3a5820, 0x4a6828, 0x5a7830, 0x6a8838, 0x7a9840],
  stone:   [0x484040, 0x585050, 0x686060, 0x787070, 0x888080],
  door:    0x401810,
  window:  0x406888,
  porch:   [0x4a3828, 0x5a4838, 0x6a5848],
  chimney: [0x504040, 0x605050, 0x706060],
  sideWall: 0x5a1810,
};

const DORN_MANOR_SMALL: SpriteTemplate = {
  w: 15, h: 13, anchorY: 12, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, M, _, _, _, M, _, _, _, _, _,
    _, _, _, _, K, M, _, _, K, M, _, _, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, _,
    _, W, W, W, N, W, W, W, W, N, W, W, E, E, _,
    _, W, W, W, W, W, W, W, W, W, W, W, E, E, _,
    _, W, W, W, W, D, W, W, W, W, W, W, E, E, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, _, _, _, _,
  ],
};

const DORN_MANOR_MEDIUM: SpriteTemplate = {
  w: 18, h: 15, anchorY: 14, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, M, _, _, _, _, M, _, _, _, _, _, _,
    _, _, _, _, _, K, M, _, _, _, K, M, _, _, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _,
    _, W, W, N, W, W, W, N, W, W, N, W, W, W, N, E, E, _,
    _, W, W, W, W, W, W, W, W, W, W, W, W, W, W, E, E, _,
    _, W, W, W, W, W, D, W, W, W, W, W, W, W, W, E, E, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _, _,
  ],
};

const DORN_MANOR_LARGE: SpriteTemplate = {
  w: 21, h: 17, anchorY: 16, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, M, _, _, _, _, _, M, _, _, _, _, _, _, _,
    _, _, _, _, _, _, K, M, _, _, _, _, K, M, _, _, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _,
    _, W, W, N, W, W, N, W, W, W, N, W, W, W, N, W, W, N, E, E, _,
    _, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, E, E, _,
    _, W, W, W, W, W, W, W, D, D, W, W, W, W, W, W, W, W, E, E, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, P, P, P, P, _, _, _, _, _, _,
  ],
};

const DORN_COTTAGE_SMALL: SpriteTemplate = {
  w: 9, h: 9, anchorY: 8, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _,
    _, R, R, R, R, R, R, R, _,
    _, R, R, R, R, R, R, R, _,
    _, W, W, W, N, W, E, E, _,
    _, W, W, W, D, W, E, E, _,
    _, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, _, _,
    _, _, _, P, P, P, _, _, _,
  ],
};

const DORN_COTTAGE_MEDIUM: SpriteTemplate = {
  w: 11, h: 10, anchorY: 9, data: [
    _, _, _, _, _, M, _, _, _, _, _,
    _, _, _, _, K, M, _, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, _,
    _, R, R, R, R, R, R, R, R, R, _,
    _, W, W, N, W, W, W, N, E, E, _,
    _, W, W, W, W, W, W, W, E, E, _,
    _, W, W, W, W, D, W, W, E, E, _,
    _, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, _, _, _,
  ],
};

const DORN_PRODUCTION_HUT: SpriteTemplate = {
  w: 9, h: 9, anchorY: 8, data: [
    _, _, _, _, M, _, _, _, _,
    _, _, _, K, M, _, _, _, _,
    _, R, R, R, R, R, R, R, _,
    _, R, R, R, R, R, R, R, _,
    _, W, W, N, W, W, E, E, _,
    _, W, W, D, W, W, E, E, _,
    _, S, S, S, S, S, S, S, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE 4: CRELL — Byzantine Intelligence
// Blue ceramic tile roofs, dark brick/stone, watchtower element, narrow windows
// ═══════════════════════════════════════════════════════════════════════════
const CRELL_PALETTE: HousePalette = {
  wall:    [0x484040, 0x585048, 0x686050, 0x787058, 0x888060],
  roof:    [0x1a3860, 0x284870, 0x385880, 0x486890, 0x5878a0],
  stone:   [0x404038, 0x505048, 0x606058, 0x707068, 0x808078],
  door:    0x2a2018,
  window:  0x3878a8,
  porch:   [0x404038, 0x505048, 0x606058],
  chimney: [0x404040, 0x505050, 0x606060],
  sideWall: 0x404038,
};

const CRELL_MANOR_SMALL: SpriteTemplate = {
  w: 14, h: 15, anchorY: 14, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, M, _, _, _, _, _, _, R, _, _,
    _, _, _, K, M, _, _, _, _, _, R, R, R, _,
    _, _, _, R, R, R, R, R, R, _, R, N, R, _,
    _, _, R, R, R, R, R, R, R, R, R, N, R, _,
    _, R, R, R, R, R, R, R, R, R, R, N, R, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, _,
    _, W, W, N, W, W, N, W, W, E, E, E, E, _,
    _, W, W, W, W, W, W, W, W, E, E, E, E, _,
    _, W, W, W, D, W, W, W, W, E, E, E, E, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, _, _, _, _, _,
  ],
};

const CRELL_MANOR_MEDIUM: SpriteTemplate = {
  w: 17, h: 17, anchorY: 16, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, M, _, _, _, _, _, _, _, R, _, _, _,
    _, _, _, _, K, M, _, _, _, _, _, _, R, R, R, _, _,
    _, _, _, R, R, R, R, R, R, R, R, _, R, N, R, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, N, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, N, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, W, W, N, W, W, N, W, W, N, W, W, E, E, E, _, _,
    _, W, W, W, W, W, W, W, W, W, W, W, E, E, E, _, _,
    _, W, W, W, W, W, D, W, W, W, W, W, E, E, E, _, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _, _,
  ],
};

const CRELL_MANOR_LARGE: SpriteTemplate = {
  w: 20, h: 19, anchorY: 18, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, M, _, _, _, _, _, _, _, _, _, R, _, _, _,
    _, _, _, _, _, K, M, _, _, _, _, _, _, _, _, R, R, R, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, R, R, _, R, N, R, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, N, R, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, N, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, W, W, N, W, W, N, W, W, N, W, W, N, W, E, E, E, E, E, _,
    _, W, W, W, W, W, W, W, W, W, W, W, W, W, E, E, E, E, E, _,
    _, W, W, W, W, W, W, W, D, W, W, W, W, W, E, E, E, E, E, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, P, P, P, P, _, _, _, _, _, _, _, _,
  ],
};

const CRELL_COTTAGE_SMALL: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, W, W, E, _, _,
    _, _, W, W, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, P, P, P, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

const CRELL_COTTAGE_MEDIUM: SpriteTemplate = {
  w: 10, h: 11, anchorY: 10, data: [
    _, _, _, _, _, _, _, _, _, _,
    _, _, _, K, _, _, _, _, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, _, W, N, W, W, N, E, _, _,
    _, _, W, W, W, W, W, E, _, _,
    _, _, W, W, D, W, W, E, _, _,
    _, _, S, S, S, S, S, S, _, _,
    _, _, _, P, P, P, P, _, _, _,
    _, _, _, _, P, P, _, _, _, _,
  ],
};

const CRELL_PRODUCTION_HUT: SpriteTemplate = {
  w: 9, h: 9, anchorY: 8, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, K, _, _, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, W, W, E, _, _,
    _, _, W, W, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE 5: VAEL — Celtic/Druidic Agrarian
// Round wattle-and-daub, living green/moss roofs, organic shapes
// ═══════════════════════════════════════════════════════════════════════════
const VAEL_PALETTE: HousePalette = {
  wall:    [0x8a7048, 0x9a8058, 0xaa9068, 0xbaa078, 0xcab088],
  roof:    [0x2a5818, 0x3a6828, 0x4a7838, 0x5a8848, 0x6a9858],
  stone:   [0x685838, 0x786840, 0x887848, 0x988850, 0xa89858],
  door:    0x503818,
  window:  0x50a060,
  porch:   [0x706038, 0x807040, 0x908048],
  chimney: [0x605840, 0x706850, 0x807860],
  sideWall: 0x7a6038,
};

// Vael's buildings have a rounder, more organic silhouette
const VAEL_MANOR_SMALL: SpriteTemplate = {
  w: 13, h: 13, anchorY: 12, data: [
    _, _, _, _, M, _, _, _, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, R, R, R, _, _,
    _, _, W, N, W, W, N, W, W, E, E, _, _,
    _, _, W, W, W, D, W, W, W, E, E, _, _,
    _, _, S, S, S, S, S, S, S, S, S, _, _,
    _, _, _, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, _, _, _, _, _,
  ],
};

const VAEL_MANOR_MEDIUM: SpriteTemplate = {
  w: 16, h: 15, anchorY: 14, data: [
    _, _, _, _, _, M, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, K, M, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, R, R, R, R, R, R, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, W, N, W, W, N, W, W, N, W, W, E, E, _, _,
    _, _, W, W, W, W, W, W, W, W, W, W, E, E, _, _,
    _, _, W, W, W, W, D, W, W, W, W, W, E, E, _, _,
    _, _, S, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _,
  ],
};

const VAEL_MANOR_LARGE: SpriteTemplate = {
  w: 19, h: 17, anchorY: 16, data: [
    _, _, _, _, _, _, _, M, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, K, M, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, R, R, R, R, R, R, _, _, _, _, _, _,
    _, _, _, _, _, _, R, R, R, R, R, R, R, R, _, _, _, _, _,
    _, _, _, _, _, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _,
    _, _, _, W, N, W, W, N, W, W, N, W, W, N, W, E, E, _, _,
    _, _, _, W, W, W, W, W, W, W, W, W, W, W, W, E, E, _, _,
    _, _, _, W, W, W, W, W, D, W, W, W, W, W, W, E, E, _, _,
    _, _, _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, _, P, P, P, P, P, P, _, _, _, _, _, _,
  ],
};

const VAEL_COTTAGE_SMALL: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, M, _, _, _, _, _,
    _, _, _, K, _, _, _, _, _,
    _, _, _, R, R, R, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, P, P, P, _, _, _,
    _, _, _, _, P, _, _, _, _,
  ],
};

const VAEL_COTTAGE_MEDIUM: SpriteTemplate = {
  w: 10, h: 11, anchorY: 10, data: [
    _, _, _, _, M, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _, _,
    _, _, _, _, R, R, R, _, _, _,
    _, _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, R, _,
    _, _, R, R, R, R, R, R, R, _,
    _, _, R, R, R, R, R, R, R, _,
    _, _, W, N, W, D, W, N, E, _,
    _, _, S, S, S, S, S, S, S, _,
    _, _, _, P, P, P, P, P, _, _,
    _, _, _, _, P, P, P, _, _, _,
  ],
};

const VAEL_PRODUCTION_HUT: SpriteTemplate = {
  w: 9, h: 9, anchorY: 8, data: [
    _, _, _, M, _, _, _, _, _,
    _, _, _, K, _, _, _, _, _,
    _, _, _, R, R, R, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE 6: ORVYN — Hanseatic/German Efficient
// Half-timber Fachwerk, steep dark slate roof, white plaster, orderly
// ═══════════════════════════════════════════════════════════════════════════
const ORVYN_PALETTE: HousePalette = {
  wall:    [0xd0c8b8, 0xd8d0c0, 0xe0d8c8, 0xe8e0d0, 0xf0e8d8],
  roof:    [0x383840, 0x484848, 0x585858, 0x686868, 0x787878],
  stone:   [0x585050, 0x686060, 0x787070, 0x888080, 0x989090],
  door:    0x3a2810,
  window:  0x4890b8,
  porch:   [0x504838, 0x605840, 0x706848],
  chimney: [0x484048, 0x585058, 0x686068],
  sideWall: 0xc0b8a8,
  beam:    0x3a2810,
};

const ORVYN_MANOR_SMALL: SpriteTemplate = {
  w: 13, h: 14, anchorY: 13, data: [
    _, _, _, _, _, M, _, _, _, _, _, _, _,
    _, _, _, _, K, M, _, _, _, _, _, _, _,
    _, _, _, _, R, R, R, _, _, _, _, _, _,
    _, _, _, R, R, R, R, R, _, _, _, _, _,
    _, _, R, R, R, R, R, R, R, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, _, _, _,
    _, W, F, N, F, W, F, N, E, E, E, _, _,
    _, F, W, W, W, F, W, W, E, E, E, _, _,
    _, W, F, W, D, W, F, W, E, E, E, _, _,
    _, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, _, _, _, _, _,
  ],
};

const ORVYN_MANOR_MEDIUM: SpriteTemplate = {
  w: 16, h: 16, anchorY: 15, data: [
    _, _, _, _, _, _, M, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, K, M, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, R, R, R, _, _, _, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, _, _, _, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, _, _, _, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, _, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, W, F, N, F, W, F, N, F, W, F, E, E, E, _, _,
    _, F, W, W, W, F, W, W, W, F, W, E, E, E, _, _,
    _, W, F, W, W, W, D, W, W, W, F, E, E, E, _, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _,
  ],
};

const ORVYN_MANOR_LARGE: SpriteTemplate = {
  w: 19, h: 18, anchorY: 17, data: [
    _, _, _, _, _, _, _, _, M, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, K, M, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, R, R, R, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, R, R, R, R, R, _, _, _, _, _, _, _, _,
    _, _, _, _, _, R, R, R, R, R, R, R, _, _, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, R, _, _, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _, _,
    _, _, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, W, F, N, F, W, F, N, F, W, F, N, F, W, E, E, E, E, _,
    _, F, W, W, W, F, W, W, W, F, W, W, W, F, E, E, E, E, _,
    _, W, F, W, W, W, W, D, W, W, W, W, W, F, E, E, E, E, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, P, P, _, _, _, _, _, _,
  ],
};

const ORVYN_COTTAGE_SMALL: SpriteTemplate = {
  w: 9, h: 11, anchorY: 10, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _,
    _, _, _, R, R, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, _, _,
    _, W, F, N, F, E, E, _, _,
    _, F, W, D, W, E, E, _, _,
    _, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, _, _, _,
    _, _, _, P, P, _, _, _, _,
  ],
};

const ORVYN_COTTAGE_MEDIUM: SpriteTemplate = {
  w: 10, h: 12, anchorY: 11, data: [
    _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, K, M, _, _, _, _,
    _, _, _, _, R, R, _, _, _, _,
    _, _, _, R, R, R, R, _, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, R, R, R, R, R, R, R, R, _,
    _, R, R, R, R, R, R, R, R, _,
    _, W, F, N, F, W, F, N, E, _,
    _, F, W, W, W, F, D, W, E, _,
    _, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, _, _, _,
  ],
};

const ORVYN_PRODUCTION_HUT: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, M, _, _, _, _,
    _, _, _, K, M, _, _, _, _,
    _, _, _, R, R, _, _, _, _,
    _, _, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, _, _,
    _, W, F, N, F, E, E, _, _,
    _, F, W, D, W, E, E, _, _,
    _, S, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE 7: VAREK — Roman Military
// Fortress-keep style, crenellations, stone walls, crimson tile, arrow slits
// ═══════════════════════════════════════════════════════════════════════════
const VAREK_PALETTE: HousePalette = {
  wall:    [0x686060, 0x787070, 0x888080, 0x989090, 0xa8a0a0],
  roof:    [0x6a1818, 0x7a2020, 0x8a2828, 0x9a3030, 0xaa3838],
  stone:   [0x585050, 0x686060, 0x787070, 0x888080, 0x989090],
  door:    0x2a1808,
  window:  0x2a2028,
  porch:   [0x505048, 0x606058, 0x707068],
  chimney: [0x585050, 0x686060, 0x787070],
  sideWall: 0x585858,
  crenellation: 0x787070,
  banner: 0x8c2020,
};

const VAREK_MANOR_SMALL: SpriteTemplate = {
  w: 13, h: 14, anchorY: 13, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, M, _, _, _, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _, _, _, _, _,
    _, C, _, C, _, C, _, C, _, C, _, _, _,
    _, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, _, _, _,
    _, W, W, N, W, W, N, W, E, E, E, _, _,
    _, W, W, W, W, W, W, W, E, E, E, _, _,
    _, W, W, W, D, W, W, W, E, E, E, _, _,
    _, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, _, _, _, _, _,
  ],
};

const VAREK_MANOR_MEDIUM: SpriteTemplate = {
  w: 16, h: 16, anchorY: 15, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, M, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, K, M, _, _, _, _, _, _, _, _, _, _,
    _, C, _, C, _, C, _, C, _, C, _, C, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, W, W, N, W, W, N, W, W, N, W, E, E, E, _, _,
    _, W, W, W, W, W, W, W, W, W, W, E, E, E, _, _,
    _, W, W, W, W, W, D, W, W, W, W, E, E, E, _, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _,
  ],
};

const VAREK_MANOR_LARGE: SpriteTemplate = {
  w: 19, h: 18, anchorY: 17, data: [
    _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, M, _, _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, K, M, _, _, _, _, _, _, _, _, _, _, _,
    _, C, _, C, _, C, _, C, _, C, _, C, _, C, _, C, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, _, _, _,
    _, W, W, N, W, W, N, W, W, N, W, W, N, W, E, E, E, E, _,
    _, W, W, W, W, W, W, W, W, W, W, W, W, W, E, E, E, E, _,
    _, W, W, W, W, W, W, D, W, W, W, W, W, W, E, E, E, E, _,
    _, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, S, _,
    _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _,
    _, _, _, P, P, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _, _,
  ],
};

const VAREK_COTTAGE_SMALL: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, W, W, E, _, _,
    _, _, W, W, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, P, P, P, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

const VAREK_COTTAGE_MEDIUM: SpriteTemplate = {
  w: 10, h: 11, anchorY: 10, data: [
    _, _, _, _, _, _, _, _, _, _,
    _, _, _, K, _, _, _, _, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, _, _,
    _, _, W, W, N, W, N, E, _, _,
    _, _, W, W, W, W, W, E, _, _,
    _, _, W, W, D, W, W, E, _, _,
    _, _, S, S, S, S, S, S, _, _,
    _, _, _, P, P, P, P, _, _, _,
    _, _, _, _, P, P, _, _, _, _,
  ],
};

const VAREK_PRODUCTION_HUT: SpriteTemplate = {
  w: 9, h: 9, anchorY: 8, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, K, _, _, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, W, W, E, _, _,
    _, _, W, W, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HOUSE 8: BRYNN — Scottish Highland
// Round broch tower, thick dry-stone walls, conical weathered slate roof
// ═══════════════════════════════════════════════════════════════════════════
const BRYNN_PALETTE: HousePalette = {
  wall:    [0x585048, 0x686058, 0x787068, 0x888078, 0x989088],
  roof:    [0x404838, 0x505840, 0x606848, 0x707850, 0x808858],
  stone:   [0x484038, 0x585048, 0x686058, 0x787068, 0x888078],
  door:    0x3a2818,
  window:  0x386080,
  porch:   [0x504838, 0x605840, 0x706848],
  chimney: [0x585048, 0x686058, 0x787068],
  sideWall: 0x585048,
};

// Brynn has round tower manors (broch-inspired)
const BRYNN_MANOR_SMALL: SpriteTemplate = {
  w: 13, h: 14, anchorY: 13, data: [
    _, _, _, _, _, M, _, _, _, _, _, _, _,
    _, _, _, _, K, M, _, _, _, _, _, _, _,
    _, _, _, _, _, R, _, _, _, _, _, _, _,
    _, _, _, _, R, R, R, _, _, _, _, _, _,
    _, _, _, R, R, R, R, R, _, _, _, _, _,
    _, _, R, R, R, R, R, R, R, _, _, _, _,
    _, _, R, R, R, R, R, R, R, _, _, _, _,
    _, _, W, W, N, W, W, E, E, E, _, _, _,
    _, _, W, W, W, W, W, E, E, E, _, _, _,
    _, _, W, W, D, W, W, E, E, E, _, _, _,
    _, _, S, S, S, S, S, S, S, S, _, _, _,
    _, _, _, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, P, P, _, _, _, _, _, _,
  ],
};

const BRYNN_MANOR_MEDIUM: SpriteTemplate = {
  w: 16, h: 16, anchorY: 15, data: [
    _, _, _, _, _, _, _, M, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, K, M, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, R, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, R, R, R, _, _, _, _, _, _, _,
    _, _, _, _, _, R, R, R, R, R, _, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, _, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, W, W, N, W, W, N, W, W, E, E, E, _, _,
    _, _, _, W, W, W, W, W, W, W, W, E, E, E, _, _,
    _, _, _, W, W, W, W, D, W, W, W, E, E, E, _, _,
    _, _, _, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, _, _, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, _, P, P, P, _, _, _, _, _, _,
  ],
};

const BRYNN_MANOR_LARGE: SpriteTemplate = {
  w: 19, h: 18, anchorY: 17, data: [
    _, _, _, _, _, _, _, _, _, M, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, K, M, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _, R, _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, R, R, R, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, R, R, R, R, R, _, _, _, _, _, _, _,
    _, _, _, _, _, _, R, R, R, R, R, R, R, _, _, _, _, _, _,
    _, _, _, _, _, R, R, R, R, R, R, R, R, R, _, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, _, R, R, R, R, R, R, R, R, R, R, R, _, _, _, _,
    _, _, _, _, W, W, N, W, W, N, W, W, N, W, E, E, E, _, _,
    _, _, _, _, W, W, W, W, W, W, W, W, W, W, E, E, E, _, _,
    _, _, _, _, W, W, W, W, D, W, W, W, W, W, E, E, E, _, _,
    _, _, _, _, S, S, S, S, S, S, S, S, S, S, S, S, S, _, _,
    _, _, _, _, _, P, P, P, P, P, P, P, P, P, P, P, _, _, _,
    _, _, _, _, _, _, P, P, P, P, P, P, P, P, P, _, _, _, _,
    _, _, _, _, _, _, _, P, P, P, P, P, P, P, _, _, _, _, _,
    _, _, _, _, _, _, _, _, P, P, P, P, P, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _, P, P, P, _, _, _, _, _, _, _,
  ],
};

const BRYNN_COTTAGE_SMALL: SpriteTemplate = {
  w: 9, h: 10, anchorY: 9, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _,
    _, _, _, _, R, _, _, _, _,
    _, _, _, R, R, R, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, W, N, W, E, _, _,
    _, _, W, W, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, P, P, P, _, _, _,
    _, _, _, _, P, _, _, _, _,
  ],
};

const BRYNN_COTTAGE_MEDIUM: SpriteTemplate = {
  w: 10, h: 11, anchorY: 10, data: [
    _, _, _, _, _, _, _, _, _, _,
    _, _, _, _, K, M, _, _, _, _,
    _, _, _, _, _, R, _, _, _, _,
    _, _, _, _, R, R, R, _, _, _,
    _, _, _, R, R, R, R, R, _, _,
    _, _, R, R, R, R, R, R, R, _,
    _, _, W, W, N, W, N, W, E, _,
    _, _, W, W, W, W, W, W, E, _,
    _, _, S, S, S, S, S, S, S, _,
    _, _, _, P, P, P, P, P, _, _,
    _, _, _, _, P, P, P, _, _, _,
  ],
};

const BRYNN_PRODUCTION_HUT: SpriteTemplate = {
  w: 9, h: 9, anchorY: 8, data: [
    _, _, _, _, _, _, _, _, _,
    _, _, _, K, M, _, _, _, _,
    _, _, _, _, R, _, _, _, _,
    _, _, _, R, R, R, _, _, _,
    _, _, R, R, R, R, R, _, _,
    _, _, W, N, D, W, E, _, _,
    _, _, S, S, S, S, S, _, _,
    _, _, _, _, _, _, _, _, _,
    _, _, _, _, _, _, _, _, _,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Assembled house styles array (indexed by duchy/house index 0-8)
// ═══════════════════════════════════════════════════════════════════════════
export const HOUSE_STYLES: HouseStyle[] = [
  // 0: Aldren — Anglo-Saxon Farmstead
  {
    name: 'Aldren',
    manorSmall: ALDREN_MANOR_SMALL,
    manorMedium: ALDREN_MANOR_MEDIUM,
    manorLarge: ALDREN_MANOR_LARGE,
    cottageSmall: ALDREN_COTTAGE_SMALL,
    cottageMedium: ALDREN_COTTAGE_MEDIUM,
    productionHut: ALDREN_PRODUCTION_HUT,
    palette: ALDREN_PALETTE,
    winterPalette: winterize(ALDREN_PALETTE),
    cropStyle: 'wheat',
    cattleColor: [0x8a6830, 0x6a4820, 0xc0a878],
    cattleName: 'Brown cattle',
  },
  // 1: Mira — Venetian Merchant
  {
    name: 'Mira',
    manorSmall: MIRA_MANOR_SMALL,
    manorMedium: MIRA_MANOR_MEDIUM,
    manorLarge: MIRA_MANOR_LARGE,
    cottageSmall: MIRA_COTTAGE_SMALL,
    cottageMedium: MIRA_COTTAGE_MEDIUM,
    productionHut: MIRA_PRODUCTION_HUT,
    palette: MIRA_PALETTE,
    winterPalette: winterize(MIRA_PALETTE),
    cropStyle: 'vine',
    cattleColor: [0xf0e8d8, 0x8a6030, 0xf8f0e0],
    cattleName: 'Spotted white cattle',
  },
  // 2: Sera — Burgundian Court
  {
    name: 'Sera',
    manorSmall: SERA_MANOR_SMALL,
    manorMedium: SERA_MANOR_MEDIUM,
    manorLarge: SERA_MANOR_LARGE,
    cottageSmall: SERA_COTTAGE_SMALL,
    cottageMedium: SERA_COTTAGE_MEDIUM,
    productionHut: SERA_PRODUCTION_HUT,
    palette: SERA_PALETTE,
    winterPalette: winterize(SERA_PALETTE),
    cropStyle: 'herb',
    cattleColor: [0xf0e8e0, 0xe8e0d8, 0xf8f0e8],
    cattleName: 'White cattle',
  },
  // 3: Dorn — Norse/Viking
  {
    name: 'Dorn',
    manorSmall: DORN_MANOR_SMALL,
    manorMedium: DORN_MANOR_MEDIUM,
    manorLarge: DORN_MANOR_LARGE,
    cottageSmall: DORN_COTTAGE_SMALL,
    cottageMedium: DORN_COTTAGE_MEDIUM,
    productionHut: DORN_PRODUCTION_HUT,
    palette: DORN_PALETTE,
    winterPalette: winterize(DORN_PALETTE),
    cropStyle: 'root_veg',
    cattleColor: [0x684828, 0x503818, 0x886848],
    cattleName: 'Shaggy highland cattle',
  },
  // 4: Crell — Byzantine Intelligence
  {
    name: 'Crell',
    manorSmall: CRELL_MANOR_SMALL,
    manorMedium: CRELL_MANOR_MEDIUM,
    manorLarge: CRELL_MANOR_LARGE,
    cottageSmall: CRELL_COTTAGE_SMALL,
    cottageMedium: CRELL_COTTAGE_MEDIUM,
    productionHut: CRELL_PRODUCTION_HUT,
    palette: CRELL_PALETTE,
    winterPalette: winterize(CRELL_PALETTE),
    cropStyle: 'barley',
    cattleColor: [0x808080, 0x606060, 0xa0a0a0],
    cattleName: 'Grey cattle',
  },
  // 5: Vael — Celtic/Druidic Agrarian
  {
    name: 'Vael',
    manorSmall: VAEL_MANOR_SMALL,
    manorMedium: VAEL_MANOR_MEDIUM,
    manorLarge: VAEL_MANOR_LARGE,
    cottageSmall: VAEL_COTTAGE_SMALL,
    cottageMedium: VAEL_COTTAGE_MEDIUM,
    productionHut: VAEL_PRODUCTION_HUT,
    palette: VAEL_PALETTE,
    winterPalette: winterize(VAEL_PALETTE),
    cropStyle: 'mixed',
    cattleColor: [0xa04020, 0x802818, 0xc06838],
    cattleName: 'Red cattle',
  },
  // 6: Orvyn — Hanseatic/German
  {
    name: 'Orvyn',
    manorSmall: ORVYN_MANOR_SMALL,
    manorMedium: ORVYN_MANOR_MEDIUM,
    manorLarge: ORVYN_MANOR_LARGE,
    cottageSmall: ORVYN_COTTAGE_SMALL,
    cottageMedium: ORVYN_COTTAGE_MEDIUM,
    productionHut: ORVYN_PRODUCTION_HUT,
    palette: ORVYN_PALETTE,
    winterPalette: winterize(ORVYN_PALETTE),
    cropStyle: 'rye',
    cattleColor: [0x202020, 0xf0f0f0, 0xf0f0f0],
    cattleName: 'Holstein cattle',
  },
  // 7: Varek — Roman Military
  {
    name: 'Varek',
    manorSmall: VAREK_MANOR_SMALL,
    manorMedium: VAREK_MANOR_MEDIUM,
    manorLarge: VAREK_MANOR_LARGE,
    cottageSmall: VAREK_COTTAGE_SMALL,
    cottageMedium: VAREK_COTTAGE_MEDIUM,
    productionHut: VAREK_PRODUCTION_HUT,
    palette: VAREK_PALETTE,
    winterPalette: winterize(VAREK_PALETTE),
    cropStyle: 'wheat',
    cattleColor: [0x603018, 0x401808, 0x885030],
    cattleName: 'War horses',
  },
  // 8: Brynn — Scottish Highland
  {
    name: 'Brynn',
    manorSmall: BRYNN_MANOR_SMALL,
    manorMedium: BRYNN_MANOR_MEDIUM,
    manorLarge: BRYNN_MANOR_LARGE,
    cottageSmall: BRYNN_COTTAGE_SMALL,
    cottageMedium: BRYNN_COTTAGE_MEDIUM,
    productionHut: BRYNN_PRODUCTION_HUT,
    palette: BRYNN_PALETTE,
    winterPalette: winterize(BRYNN_PALETTE),
    cropStyle: 'oat',
    cattleColor: [0xc08040, 0xa06828, 0xe0a860],
    cattleName: 'Highland cattle',
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Get house style by duchy index (0-8), with safe fallback to Aldren */
export function getHouseStyle(duchyIndex: number): HouseStyle {
  return HOUSE_STYLES[duchyIndex] ?? HOUSE_STYLES[0];
}

/** Get the seasonal palette for a house */
export function getHousePalette(duchyIndex: number, season: Season): HousePalette {
  const style = getHouseStyle(duchyIndex);
  return season === Season.Winter ? style.winterPalette : style.palette;
}

/** Pick a manor template based on cell size + rng (same logic as original) */
export function pickManorTemplate(
  duchyIndex: number,
  cellW: number,
  cellH: number,
  rng: () => number,
): SpriteTemplate {
  const style = getHouseStyle(duchyIndex);
  const cellDim = Math.min(cellW, cellH);
  if (cellDim >= 20) {
    return rng() < 0.4 ? style.manorLarge : style.manorMedium;
  } else if (cellDim >= 15) {
    return rng() < 0.5 ? style.manorMedium : style.manorSmall;
  } else {
    return rng() < 0.3 ? style.manorMedium : style.manorSmall;
  }
}

/** Pick a cottage template based on rng */
export function pickCottageTemplate(
  duchyIndex: number,
  rng: () => number,
): SpriteTemplate {
  const style = getHouseStyle(duchyIndex);
  return rng() < 0.6 ? style.cottageSmall : style.cottageMedium;
}

/** Get production hut template for a duchy */
export function getProductionHut(duchyIndex: number): SpriteTemplate {
  return getHouseStyle(duchyIndex).productionHut;
}

// ---------------------------------------------------------------------------
// Extended cell type constants (exported for renderers)
// ---------------------------------------------------------------------------
export const CELL_TYPES = {
  TRANSPARENT: 0,
  WALL: 1,
  ROOF: 2,
  DOOR: 3,
  STONE: 4,
  WINDOW: 5,
  PORCH: 6,
  CHIMNEY: 7,
  SIDE_WALL: 8,
  SMOKE: 9,
  BANNER: 10,
  BEAM: 11,
  TURRET: 12,
  CRENELLATION: 13,
} as const;
