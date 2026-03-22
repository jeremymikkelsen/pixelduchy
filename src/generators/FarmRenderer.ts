/**
 * FarmRenderer — renders grain fields, gardens, and cow pastures
 * onto the pixel buffer in a single pass over regionGrid.
 *
 * Grain fields: 3/4-perspective stalk columns oriented along the region's
 * long axis. Stalks are 2px wide × 3px tall with a 2px furrow gap between rows.
 *
 * Gardens: tilled soil with 2-3 crop patches, each filled with an
 * organic dot pattern using noise.
 *
 * Pastures: worn/patchy grass. Cow animation is handled by PastureAnimator.
 * Interior pixels are captured here for per-frame cow erasure.
 */

import { createNoise2D } from 'simplex-noise';
import { TopographyGenerator, mulberry32 } from './TopographyGenerator';
import { packABGR, applyBrightness } from './TerrainPalettes';
import { Season } from '../state/Season';
import type { AgImprovementType } from '../state/AgImprovements';
import { getHouseStyle } from './HouseStyles';

const GRAIN_BRIGHTNESS = 1.25;

// ── Garden palettes ───────────────────────────────────────────────────────────

const VEGGIE_SOIL = {
  [Season.Winter]: packABGR(0x68, 0x58, 0x48),
  [Season.Spring]: packABGR(0x3d, 0x2b, 0x14),
  [Season.Summer]: packABGR(0x48, 0x34, 0x18),
  [Season.Fall]: packABGR(0x52, 0x3c, 0x20),
};

// ── Dirt path color — worn earth at field/garden cell boundaries ──────────────
const DIRT_PATH_COLOR = {
  [Season.Winter]: packABGR(0x7a, 0x6a, 0x5a),
  [Season.Spring]: packABGR(0x56, 0x3c, 0x20),
  [Season.Summer]: packABGR(0x50, 0x38, 0x1c),
  [Season.Fall]:   packABGR(0x5c, 0x40, 0x22),
};

// Per-crop-type leaf color pairs (shadow, highlight) — Spring and Summer
// Fall/Winter use inline values for vines/snow
const LEAF_SPRING: [number, number][] = [
  [0x2a5c18, 0x3e8026],  // 0: leafy greens
  [0x3a7020, 0x509430],  // 1: root-veg tops
  [0x266018, 0x3a8828],  // 2: broad-leaf
];
const LEAF_SUMMER: [number, number][] = [
  [0x1e5a18, 0x389030],  // 0: dark lush
  [0x3a7820, 0x58a030],  // 1: medium green
  [0x286820, 0x4a9428],  // 2: rich green
];

// ── Pasture palettes ──────────────────────────────────────────────────────────
// A and B are kept close together so the noise variation reads as a uniform
// green field rather than a blotchy two-tone pattern.
// Pasture colors (RGB hex — applyBrightness converts to ABGR)
const PASTURE_A = {
  [Season.Winter]: 0xb8c4b0,
  [Season.Spring]: 0x528a2e,
  [Season.Summer]: 0x467c28,
  [Season.Fall]:   0x586e28,
};
const PASTURE_B = {
  [Season.Winter]: 0xc4d0bc,
  [Season.Spring]: 0x5c9834,
  [Season.Summer]: 0x508a2e,
  [Season.Fall]:   0x627a2c,
};

// ── Crop style color palettes — per-house visual variety ──────────────────────
// Fall: [furrow, row1a, row1b, row2a, row2b, row3a, row3b]
const CROP_FALL_COLORS: Record<string, number[]> = {
  wheat:    [0x8a6820, 0xb88828, 0xa07820, 0xd8a838, 0xc89830, 0xf0cc50, 0xe8c040],
  rice:     [0x6a7828, 0x98a838, 0x889828, 0xb8c848, 0xa8b838, 0xd0e050, 0xc8d848],
  root_veg: [0x5a4020, 0x7a5828, 0x6a4820, 0x8a6838, 0x806030, 0xa88848, 0x987840],
  vine:     [0x584020, 0x804828, 0x703820, 0x985838, 0x885030, 0xb87048, 0xa86040],
  herb:     [0x385020, 0x508828, 0x407020, 0x68a838, 0x589830, 0x80c048, 0x70b040],
  oat:      [0x787040, 0xa89850, 0x988840, 0xc0b060, 0xb0a050, 0xd8c878, 0xc8b868],
  mixed:    [0x607028, 0x889838, 0x788828, 0xa0b048, 0x90a038, 0xb8c858, 0xa8b848],
  barley:   [0x887830, 0xb09838, 0xa08830, 0xc8b048, 0xb8a040, 0xe0c860, 0xd0b850],
  rye:      [0x787030, 0xa09040, 0x908030, 0xb8a850, 0xa89840, 0xd0c068, 0xc0b058],
};

// Summer: [furrow, row1, row2a, row2b, row3a, row3b]
const CROP_SUMMER_COLORS: Record<string, number[]> = {
  wheat:    [0x2a3818, 0x3a5818, 0x5a9830, 0x4a8828, 0x88b838, 0x70a030],
  rice:     [0x284830, 0x388838, 0x48a848, 0x389838, 0x68c858, 0x58b848],
  root_veg: [0x2a3018, 0x3a4818, 0x507830, 0x406828, 0x689038, 0x588030],
  vine:     [0x283818, 0x385020, 0x4a7828, 0x3a6820, 0x609838, 0x508830],
  herb:     [0x204018, 0x306020, 0x409028, 0x308020, 0x58b038, 0x48a030],
  oat:      [0x303818, 0x405818, 0x608830, 0x507828, 0x78a838, 0x689830],
  mixed:    [0x284020, 0x386828, 0x489838, 0x388828, 0x60b848, 0x50a838],
  barley:   [0x2a3818, 0x3a5818, 0x589030, 0x488028, 0x80a838, 0x709830],
  rye:      [0x283818, 0x385018, 0x508830, 0x407828, 0x78a038, 0x689030],
};

// ── Orchard tree sprites — 75% of small deciduous (5×7 → 5×5 / 5×6) ─────────
// Cell types: 0 = transparent, 1 = trunk, 2 = canopy

const ORCHARD_TEMPLATES: { w: number; h: number; data: number[] }[] = [
  // Compact round (5×5) — 75% of small deciduous 5×7
  { w: 5, h: 5, data: [
    0, 2, 2, 2, 0,
    2, 2, 2, 2, 2,
    2, 2, 2, 2, 2,
    0, 2, 2, 2, 0,
    0, 0, 1, 0, 0,
  ]},
  // Taller round (5×6)
  { w: 5, h: 6, data: [
    0, 0, 2, 0, 0,
    0, 2, 2, 2, 0,
    2, 2, 2, 2, 2,
    2, 2, 2, 2, 2,
    0, 2, 2, 2, 0,
    0, 0, 1, 0, 0,
  ]},
  // Scalloped (5×5)
  { w: 5, h: 5, data: [
    0, 2, 2, 0, 0,
    2, 2, 2, 2, 0,
    2, 2, 2, 2, 2,
    0, 2, 2, 2, 0,
    0, 0, 1, 0, 0,
  ]},
  // Wide low (5×5) — slightly asymmetric
  { w: 5, h: 5, data: [
    0, 2, 2, 2, 0,
    2, 2, 2, 2, 2,
    0, 2, 2, 2, 2,
    0, 2, 2, 2, 0,
    0, 0, 1, 0, 0,
  ]},
];

// Bare orchard trees for winter (all pixels are trunk/branch)
const ORCHARD_BARE_TEMPLATES: { w: number; h: number; data: number[] }[] = [
  // Forked top
  { w: 5, h: 5, data: [
    0, 1, 0, 1, 0,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 0,
  ]},
  // Three prongs
  { w: 5, h: 6, data: [
    1, 0, 1, 0, 1,
    0, 1, 1, 1, 0,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 0,
  ]},
  // Bent with stub
  { w: 5, h: 5, data: [
    0, 0, 1, 0, 0,
    0, 0, 1, 1, 0,
    0, 1, 1, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 0,
  ]},
  // Simple Y
  { w: 5, h: 5, data: [
    0, 1, 0, 1, 0,
    0, 1, 0, 1, 0,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 0,
  ]},
];

// ── Haystack sprites for winter grain fields (3×3 golden mound) ───────────────
const HAYSTACK_TEMPLATE = { w: 3, h: 3, data: [
  0, 1, 0,
  1, 1, 1,
  1, 1, 1,
]};
const HAYSTACK_COLORS = [0xb09838, 0x988030, 0xc0a840]; // golden straw shades

// Lighting direction (matches TreeRenderer)
const ORCHARD_LIGHT_X = -0.707;
const ORCHARD_LIGHT_Y = -0.707;

// ── Orchard palettes ─────────────────────────────────────────────────────────
interface OrchardPalette {
  canopy: number[];   // 5 shades: shadow → highlight (RGB hex)
  trunk: number[];    // 2 shades: light, dark
  apple?: number;     // fall only: red apple RGB hex
}

function getOrchardPalette(season: Season, _seed: number): OrchardPalette {
  switch (season) {
    case Season.Spring:
      // Bright spring green — blossoms handled separately in stamp
      return {
        canopy: [0x308030, 0x48a040, 0x58b850, 0x70cc60, 0x88e070],
        trunk: [0x8a7860, 0x5a4a38],
      };
    case Season.Summer:
      // Vivid bright green
      return {
        canopy: [0x2a6828, 0x3a8838, 0x4ca848, 0x60c058, 0x78d868],
        trunk: [0x8a7860, 0x5a4a38],
      };
    case Season.Fall:
      // Golden yellow foliage with red apples
      return {
        canopy: [0x987818, 0xb09020, 0xc8a828, 0xd8b830, 0xe8cc40],
        trunk: [0x8a7860, 0x5a4a38],
        apple: 0xcc2222,
      };
    case Season.Winter:
      return {
        canopy: [0x2a2018, 0x3a2c20, 0x483828, 0x584830, 0x685838],
        trunk: [0x7a6848, 0x584030],
      };
  }
}

function _darkenPixel(abgr: number, factor: number): number {
  const r = Math.floor((abgr & 0xff) * factor);
  const g = Math.floor(((abgr >> 8) & 0xff) * factor);
  const b = Math.floor(((abgr >> 16) & 0xff) * factor);
  return (255 << 24) | (b << 16) | (g << 8) | r;
}

// ── RegionMeta: axis info per improvement region ──────────────────────────────
interface RegionMeta {
  minX: number; maxX: number; minY: number; maxY: number;
  // Long-axis unit vector (direction of rows in grain/garden)
  longX: number; longY: number;
  // Perp unit vector (stalk growth direction)
  perpX: number; perpY: number;
}

// ── Public output ─────────────────────────────────────────────────────────────
export interface PastureData {
  regionIndex: number;
  minX: number; maxX: number; minY: number; maxY: number;
  interiorPixels: { idx: number; color: number }[];
}

export interface GardenData {
  regionIndex: number;
  minX: number; maxX: number; minY: number; maxY: number;
  /** ABGR body color for garden workers — set to duchy team color in MapScene */
  bodyColor: number;
}

// ─────────────────────────────────────────────────────────────────────────────
export class FarmRenderer {
  farmMask: Uint8Array | null = null;
  pastures: PastureData[] = [];
  gardens: GardenData[] = [];

  render(
    pixels: Uint32Array,
    N: number,
    improvements: Map<number, AgImprovementType>,
    topo: TopographyGenerator,
    regionGrid: Uint16Array,
    seed: number,
    season: Season,
    regionToDuchy?: Int8Array,
  ): void {
    if (improvements.size === 0) return;

    const rngNoise = mulberry32(seed ^ 0xfa4a01);
    const noise = createNoise2D(rngNoise);

    // Per-region PCA accumulators
    const regionIds = new Set(improvements.keys());
    const stats = new Map<number, {
      sx: number; sy: number; sxx: number; syy: number; sxy: number; n: number;
      minX: number; maxX: number; minY: number; maxY: number;
    }>();
    for (const r of regionIds) {
      stats.set(r, { sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, n: 0,
        minX: N, maxX: 0, minY: N, maxY: 0 });
    }

    // Pass 1: accumulate pixel statistics per region
    for (let i = 0; i < N * N; i++) {
      const r = regionGrid[i];
      const s = stats.get(r);
      if (!s) continue;
      const px = i % N;
      const py = (i - px) / N;
      s.sx += px; s.sy += py;
      s.sxx += px * px; s.syy += py * py; s.sxy += px * py;
      s.n++;
      if (px < s.minX) s.minX = px;
      if (px > s.maxX) s.maxX = px;
      if (py < s.minY) s.minY = py;
      if (py > s.maxY) s.maxY = py;
    }

    // Compute PCA long axis and perpendicular for each region
    const meta = new Map<number, RegionMeta>();
    const gardenCrops = new Map<number, [number, number, number]>();

    for (const [r, s] of stats) {
      if (s.n === 0) continue;
      const cx = s.sx / s.n;
      const cy = s.sy / s.n;
      const cxx = s.sxx / s.n - cx * cx;
      const cyy = s.syy / s.n - cy * cy;
      const cxy = s.sxy / s.n - cx * cy;

      // Eigenvector of larger eigenvalue of [[cxx, cxy], [cxy, cyy]]
      let lx: number, ly: number;
      if (Math.abs(cxy) > 1e-6) {
        const diff = cxx - cyy;
        const disc = Math.sqrt(diff * diff + 4 * cxy * cxy);
        const lambda = ((cxx + cyy) + disc) / 2;
        lx = lambda - cyy;
        ly = cxy;
      } else if (cxx >= cyy) {
        lx = 1; ly = 0;
      } else {
        lx = 0; ly = 1;
      }
      const len = Math.sqrt(lx * lx + ly * ly) || 1;
      lx /= len; ly /= len;

      meta.set(r, {
        minX: s.minX, maxX: s.maxX, minY: s.minY, maxY: s.maxY,
        longX: lx, longY: ly,
        perpX: -ly, perpY: lx,
      });

      if (improvements.get(r) === 'garden') {
        const rng2 = mulberry32(seed ^ (r * 0xa3b4c5));
        const types: number[] = [0, 1, 2];
        [types[0], types[Math.floor(rng2() * 3)]] = [types[Math.floor(rng2() * 3)], types[0]];
        gardenCrops.set(r, [types[0], types[1], types[2]]);
      }
    }

    // Precompute pumpkin centers for fall garden regions (2–3 per region)
    const gardenPumpkins = new Map<number, { cx: number; cy: number }[]>();
    if (season === Season.Fall) {
      for (const [r, m] of meta) {
        if (improvements.get(r) !== 'garden') continue;
        const rng3 = mulberry32(seed ^ (r * 0xb7c3d5) ^ 0xf00d);
        const count = 2 + (rng3() > 0.5 ? 1 : 0);
        const W = m.maxX - m.minX;
        const H = m.maxY - m.minY;
        const centers: { cx: number; cy: number }[] = [];
        for (let k = 0; k < count; k++) {
          centers.push({
            cx: Math.round(m.minX + (0.15 + rng3() * 0.70) * W),
            cy: Math.round(m.minY + (0.15 + rng3() * 0.70) * H),
          });
        }
        gardenPumpkins.set(r, centers);
      }
    }

    // Allocate mask
    this.farmMask = new Uint8Array(N * N);
    this.pastures = [];
    this.gardens = [];
    const pastureMap = new Map<number, PastureData>();

    // Pre-create pasture data objects
    for (const [r, type] of improvements) {
      if (type === 'pasture') {
        const m = meta.get(r)!;
        const pd: PastureData = {
          regionIndex: r,
          minX: m.minX, maxX: m.maxX, minY: m.minY, maxY: m.maxY,
          interiorPixels: [],
        };
        this.pastures.push(pd);
        pastureMap.set(r, pd);
      }
    }

    // Pre-create garden data objects
    for (const [r, type] of improvements) {
      if (type === 'garden') {
        const m = meta.get(r);
        if (!m) continue;
        this.gardens.push({
          regionIndex: r,
          minX: m.minX, maxX: m.maxX, minY: m.minY, maxY: m.maxY,
          bodyColor: packABGR(0x4a, 0x5a, 0x78),  // overridden in MapScene with duchy color
        });
      }
    }

    // Pass 2: render
    for (let i = 0; i < N * N; i++) {
      const r = regionGrid[i];
      const type = improvements.get(r);
      if (!type) continue;

      const m = meta.get(r)!;
      const px = i % N;
      const py = (i - px) / N;
      this.farmMask![i] = 1;

      // 1-px dirt path at Voronoi cell boundaries (grain and garden only, not pasture)
      if (type !== 'pasture') {
        const isBoundary =
          (px > 0 && regionGrid[i - 1] !== r) ||
          (px < N - 1 && regionGrid[i + 1] !== r) ||
          (py > 0 && regionGrid[i - N] !== r) ||
          (py < N - 1 && regionGrid[i + N] !== r);
        if (isBoundary) {
          pixels[i] = DIRT_PATH_COLOR[season];
          continue;
        }
      }

      const duchyIdx = regionToDuchy ? regionToDuchy[r] : -1;
      const cropStyle = duchyIdx >= 0 ? getHouseStyle(duchyIdx).cropStyle : 'wheat';

      switch (type) {
        case 'grain':
          pixels[i] = this._grainPixel(px, py, m, season, noise, cropStyle);
          break;
        case 'garden': {
          const crops = gardenCrops.get(r)!;
          const pumpkins = gardenPumpkins.get(r);
          pixels[i] = this._veggiePixel(px, py, m, crops, season, noise, pumpkins);
          break;
        }
        case 'pasture': {
          const color = this._pasturePixel(px, py, season, noise);
          pixels[i] = color;
          pastureMap.get(r)!.interiorPixels.push({ idx: i, color });
          break;
        }
        case 'orchard':
          pixels[i] = this._orchardGround(px, py, season, noise);
          break;
      }
    }

  }

  // ── Grain stalk pixel — seasonal patterns, crop style varies by house ────────
  private _grainPixel(
    px: number, py: number, m: RegionMeta, season: Season,
    noise: (x: number, y: number) => number,
    cropStyle: string = 'wheat',
  ): number {
    const perp = px * m.perpX + py * m.perpY;

    // Crop style color variants for fall harvest
    const fallColors = CROP_FALL_COLORS[cropStyle] ?? CROP_FALL_COLORS.wheat;
    const summerColors = CROP_SUMMER_COLORS[cropStyle] ?? CROP_SUMMER_COLORS.wheat;

    // ── Winter: visible furrow rows with snow dusting + stubble ──
    if (season === Season.Winter) {
      const row = ((Math.floor(perp) % 4) + 4) % 4;
      const n1 = noise(px * 0.06, py * 0.06);
      const n2 = noise(px * 0.18 + 50, py * 0.18 + 50);
      // Snow patches — less coverage than surrounding terrain so field is distinct
      if (n1 > 0.45) {
        return applyBrightness(n1 > 0.65 ? 0xd8e0e8 : 0xc0ccd8, 0.95 + n2 * 0.08);
      }
      // Dark stubble in furrow rows
      if (row === 0) {
        return applyBrightness(0x3a2818, 1.0);  // dark furrow
      }
      // Stubble rows — tan/straw color
      if (row === 2 && n2 > -0.2) {
        return applyBrightness(n2 > 0.3 ? 0x8a7838 : 0x786830, 1.0);  // straw stubble
      }
      // Brown soil base
      return applyBrightness(n2 > 0 ? 0x685040 : 0x584030, 1.0);
    }

    // ── Spring: brown soil with single-pixel rows of sprouts ──
    if (season === Season.Spring) {
      const gp = ((Math.floor(perp) % 4) + 4) % 4;
      // Rice paddies have wider water-filled furrows in spring
      if (cropStyle === 'rice') {
        if (gp <= 1) {
          const n = noise(px * 0.15, py * 0.15);
          return applyBrightness(n > 0 ? 0x607888 : 0x506878, 1.0); // muddy water
        }
        if (gp === 2) {
          return applyBrightness(0x60a828, GRAIN_BRIGHTNESS);
        }
        return applyBrightness(0x506838, 1.0);
      }
      if (gp === 2) {
        const n = noise(px * 0.25, py * 0.25);
        return applyBrightness(n > 0 ? 0x78b830 : 0x4a8020, GRAIN_BRIGHTNESS);
      }
      const sn = noise(px * 0.12, py * 0.12);
      return applyBrightness(sn > 0 ? 0x6a4c2c : 0x5a3c20, 1.0);
    }

    // ── Summer: dense green rows, thin furrow ──
    if (season === Season.Summer) {
      const row = ((Math.floor(perp) % 4) + 4) % 4;
      if (row === 0) return applyBrightness(summerColors[0], 1.0);
      const n = noise(px * 0.2, py * 0.2);
      if (row === 1) return applyBrightness(summerColors[1], GRAIN_BRIGHTNESS);
      if (row === 2) return applyBrightness(n > 0 ? summerColors[2] : summerColors[3], GRAIN_BRIGHTNESS);
      return applyBrightness(n > 0 ? summerColors[4] : summerColors[5], GRAIN_BRIGHTNESS);
    }

    // ── Fall: dense harvest rows ──
    const row = ((Math.floor(perp) % 4) + 4) % 4;
    if (row === 0) return applyBrightness(fallColors[0], 1.0);
    const n = noise(px * 0.2, py * 0.2);
    if (row === 1) return applyBrightness(n > 0 ? fallColors[1] : fallColors[2], GRAIN_BRIGHTNESS);
    if (row === 2) return applyBrightness(n > 0 ? fallColors[3] : fallColors[4], GRAIN_BRIGHTNESS);
    return applyBrightness(n > 0 ? fallColors[5] : fallColors[6], GRAIN_BRIGHTNESS);
  }

  // ── Garden patch pixel ──────────────────────────────────────────────────────
  private _veggiePixel(
    px: number, py: number,
    m: RegionMeta,
    crops: [number, number, number],
    season: Season,
    noise: (x: number, y: number) => number,
    pumpkins?: { cx: number; cy: number }[],
  ): number {
    // Divide bbox into 3 strips, boundaries blurred by low-freq noise
    const W = m.maxX - m.minX || 1;
    const H = m.maxY - m.minY || 1;
    const isHoriz = W >= H;
    const stripBlur = noise(px * 0.08, py * 0.08) * 0.07;

    let stripIdx: number;
    if (isHoriz) {
      const rel = (px - m.minX) / W + stripBlur;
      stripIdx = rel < 0.38 ? 0 : rel < 0.68 ? 1 : 2;
    } else {
      const rel = (py - m.minY) / H + stripBlur;
      stripIdx = rel < 0.38 ? 0 : rel < 0.68 ? 1 : 2;
    }

    const cropType = crops[stripIdx];
    const soil = VEGGIE_SOIL[season];

    // ── Winter: mostly tilled dirt with snow patches + bare stems ──────────
    if (season === Season.Winter) {
      const snowN = noise(px * 0.28 + 100, py * 0.28);
      // Snow patches — only ~30% coverage so dirt shows through
      if (snowN > 0.45) {
        const sn2 = noise(px * 0.55 + 200, py * 0.55);
        return applyBrightness(sn2 > 0 ? 0xd0dce4 : 0xc0ccd8, 1.0);
      }
      // Bare stems — more frequent
      if (noise(px * 0.9 + 50, py * 0.9 + 50) > 0.72) {
        return applyBrightness(0x3c2a18, 1.0);
      }
      // Dark tilled soil — visible dirt rows
      const dirtN = noise(px * 0.4 + cropType * 3, py * 0.4);
      if (dirtN > 0.2) {
        return applyBrightness(0x4a3820, 1.0);  // darker dirt patch
      }
      return soil;
    }

    // ── Fall: vine tendrils + leaf clusters + pumpkins ──────────────────────
    if (season === Season.Fall) {
      // Pumpkins: radius-2 blobs at precomputed centers
      if (pumpkins) {
        for (const { cx, cy } of pumpkins) {
          const dx = px - cx, dy = py - cy;
          if (dx * dx + dy * dy <= 1) {
            return applyBrightness(dy < 0 ? 0xc05810 : 0xe07018, 1.0);
          }
        }
      }
      // Vine tendril: thin isoline of medium-freq noise
      const vineN = noise(px * 0.22 + cropType * 5.3, py * 0.22);
      const isVine = Math.abs(vineN) < 0.12;
      // Leaf blob: small high-freq clusters
      const leafN = noise(px * 0.46 + cropType * 3.7, py * 0.46);
      const isLeaf = leafN > 0.30;
      if (isVine || isLeaf) {
        // Red accent (~4% of plant pixels, summer+fall only)
        if (noise(px * 1.8 + 31, py * 1.8 + 31) > 0.84) {
          return applyBrightness(0x981410, 1.0);
        }
        const shade = noise(px * 0.75 + 5, py * 0.75);
        return applyBrightness(shade > 0.1 ? 0x3a6c18 : 0x285010, 1.0);
      }
      return soil;
    }

    // ── Spring: dense small organic leaf clusters ────────────────────────────
    if (season === Season.Spring) {
      const plantN = noise(px * 0.47 + cropType * 4.1, py * 0.47);
      if (plantN > 0.04) {
        const shade = noise(px * 0.82 + 11, py * 0.82 + 11);
        const [shadow, highlight] = LEAF_SPRING[cropType];
        return applyBrightness(shade > 0.15 ? highlight : shadow, 1.0);
      }
      return soil;
    }

    // ── Summer: lush larger blobs + red accents ──────────────────────────────
    const plantN = noise(px * 0.38 + cropType * 3.9, py * 0.38);
    if (plantN > -0.06) {
      // Red accent (~4% of plant pixels)
      if (noise(px * 1.7 + 22, py * 1.7 + 22) > 0.84) {
        return applyBrightness(0x8c1210, 1.0);
      }
      const shade = noise(px * 0.72 + 17, py * 0.72);
      const [shadow, highlight] = LEAF_SUMMER[cropType];
      return applyBrightness(shade > 0.15 ? highlight : shadow, 1.0);
    }
    return soil;
  }

  // ── Pasture pixel ───────────────────────────────────────────────────────────
  private _pasturePixel(
    px: number, py: number,
    season: Season,
    noise: (x: number, y: number) => number,
  ): number {
    const n = (noise(px * 0.18, py * 0.18) + 1) / 2;
    const base = n > 0.5 ? PASTURE_B[season] : PASTURE_A[season];
    return applyBrightness(base, 1.0);
  }

  // ── Orchard ground — grassy with seasonal variation ─────────────────────────
  private _orchardGround(
    px: number, py: number, season: Season,
    noise: (x: number, y: number) => number,
  ): number {
    const n = noise(px * 0.15, py * 0.15);
    switch (season) {
      case Season.Winter: {
        // Mostly bare earth with frost — clearly distinct from snowy surroundings
        const frostN = noise(px * 0.12, py * 0.12);
        // Only thin frost patches (~20%)
        if (frostN > 0.65) return applyBrightness(0xb8c0c8, 0.95);
        // Dead grass tufts
        const grassN = noise(px * 0.3 + 10, py * 0.3 + 10);
        if (grassN > 0.4) return applyBrightness(0x686038, 1.0);  // dead yellow-brown grass
        // Dark frozen earth
        return applyBrightness(n > 0 ? 0x4a4030 : 0x3c3428, 1.0);
      }
      case Season.Spring:
        return applyBrightness(n > 0 ? 0x5c9838 : 0x4a8828, 1.0);
      case Season.Summer:
        return applyBrightness(n > 0 ? 0x4a8828 : 0x3c7820, 1.0);
      case Season.Fall:
        return applyBrightness(n > 0 ? 0x6a7828 : 0x586828, 1.0);
    }
  }

  // ── Winter field haystacks — stamp small golden mounds in grain fields ───────

  renderWinterHaystacks(
    pixels: Uint32Array,
    N: number,
    improvements: Map<number, AgImprovementType>,
    regionGrid: Uint16Array,
    seed: number,
  ): void {
    // Collect grain region bounding boxes
    for (const [r, type] of improvements) {
      if (type !== 'grain') continue;
      const rng = mulberry32(seed ^ (r * 0xd7a3b1));

      // Find region bounds
      let minX = N, maxX = 0, minY = N, maxY = 0;
      const regionPixels = new Set<number>();
      for (let i = 0; i < N * N; i++) {
        if (regionGrid[i] !== r) continue;
        const px = i % N;
        const py = (i - px) / N;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        regionPixels.add(i);
      }

      const W = maxX - minX;
      const H = maxY - minY;
      if (W < 8 || H < 8) continue;

      // Place 2-4 haystacks per grain region
      const count = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const hx = Math.round(minX + (0.15 + rng() * 0.70) * W);
        const hy = Math.round(minY + (0.15 + rng() * 0.70) * H);

        // Check center is inside region
        if (!regionPixels.has(hy * N + hx)) continue;

        // Stamp haystack
        const tmpl = HAYSTACK_TEMPLATE;
        const sx = hx - Math.floor(tmpl.w / 2);
        const sy = hy - tmpl.h + 1;
        for (let row = 0; row < tmpl.h; row++) {
          for (let col = 0; col < tmpl.w; col++) {
            if (tmpl.data[row * tmpl.w + col] === 0) continue;
            const px = sx + col;
            const py = sy + row;
            if (px < 0 || px >= N || py < 0 || py >= N) continue;
            const shade = (col + row) & 1;
            const colorIdx = row === 0 ? 2 : shade; // top is highlight
            const c = HAYSTACK_COLORS[colorIdx];
            const cr = (c >> 16) & 0xff;
            const cg = (c >> 8) & 0xff;
            const cb = c & 0xff;
            pixels[py * N + px] = packABGR(cr, cg, cb);
          }
        }
      }
    }
  }

  // ── Orchard tree stamping — sprite-based, matching in-game trees at 75% ────

  /**
   * After the main pixel pass paints orchard ground, stamp tree sprites
   * in neat rows within each orchard region.
   */
  renderOrchardTrees(
    pixels: Uint32Array,
    N: number,
    improvements: Map<number, AgImprovementType>,
    regionGrid: Uint16Array,
    seed: number,
    season: Season,
  ): void {
    const regionIds: number[] = [];
    for (const [r, type] of improvements) {
      if (type === 'orchard') regionIds.push(r);
    }
    if (regionIds.length === 0) return;

    // Compute bounding box + PCA for each orchard region
    const stats = new Map<number, {
      sx: number; sy: number; sxx: number; syy: number; sxy: number; n: number;
      minX: number; maxX: number; minY: number; maxY: number;
      pixels: Set<number>;
    }>();
    for (const r of regionIds) {
      stats.set(r, {
        sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, n: 0,
        minX: N, maxX: 0, minY: N, maxY: 0,
        pixels: new Set(),
      });
    }
    for (let i = 0; i < N * N; i++) {
      const s = stats.get(regionGrid[i]);
      if (!s) continue;
      const px = i % N;
      const py = (i - px) / N;
      s.sx += px; s.sy += py;
      s.sxx += px * px; s.syy += py * py; s.sxy += px * py;
      s.n++;
      if (px < s.minX) s.minX = px;
      if (px > s.maxX) s.maxX = px;
      if (py < s.minY) s.minY = py;
      if (py > s.maxY) s.maxY = py;
      s.pixels.add(i);
    }

    // Stamp trees in each orchard region
    for (const [r, s] of stats) {
      if (s.n === 0) continue;
      const cx = s.sx / s.n;
      const cy = s.sy / s.n;
      const cxx = s.sxx / s.n - cx * cx;
      const cyy = s.syy / s.n - cy * cy;
      const cxy = s.sxy / s.n - cx * cy;

      let lx: number, ly: number;
      if (Math.abs(cxy) > 1e-6) {
        const diff = cxx - cyy;
        const disc = Math.sqrt(diff * diff + 4 * cxy * cxy);
        const lambda = ((cxx + cyy) + disc) / 2;
        lx = lambda - cyy; ly = cxy;
      } else if (cxx >= cyy) {
        lx = 1; ly = 0;
      } else {
        lx = 0; ly = 1;
      }
      const len = Math.sqrt(lx * lx + ly * ly) || 1;
      lx /= len; ly /= len;
      const perpX = -ly, perpY = lx;

      // Place trees in a grid aligned to PCA axes
      const spacing = 6;
      const rng = mulberry32(seed ^ (r * 0xc3a5b7));

      // Find range along each axis from region center
      const W = s.maxX - s.minX;
      const H = s.maxY - s.minY;
      const radius = Math.max(W, H) / 2 + spacing;

      // Shadow pass first, then sprite pass (painter's algorithm)
      interface OrchardTree { tx: number; ty: number; templateIdx: number; flipped: boolean }
      const trees: OrchardTree[] = [];

      for (let ai = -Math.ceil(radius / spacing); ai <= Math.ceil(radius / spacing); ai++) {
        for (let pi = -Math.ceil(radius / spacing); pi <= Math.ceil(radius / spacing); pi++) {
          const tx = Math.round(cx + ai * spacing * lx + pi * spacing * perpX);
          const ty = Math.round(cy + ai * spacing * ly + pi * spacing * perpY);

          // Tree trunk base must be inside the orchard region
          if (tx < 0 || tx >= N || ty < 0 || ty >= N) continue;
          if (!s.pixels.has(ty * N + tx)) continue;

          // Small margin from boundary: check 1px around trunk base
          let tooClose = false;
          for (let dy = -1; dy <= 1 && !tooClose; dy++) {
            for (let dx = -1; dx <= 1 && !tooClose; dx++) {
              const nx = tx + dx, ny = ty + dy;
              if (nx < 0 || nx >= N || ny < 0 || ny >= N) { tooClose = true; break; }
              if (!s.pixels.has(ny * N + nx)) tooClose = true;
            }
          }
          if (tooClose) continue;

          trees.push({
            tx, ty,
            templateIdx: Math.floor(rng() * ORCHARD_TEMPLATES.length),
            flipped: rng() > 0.5,
          });
        }
      }

      // Sort by Y for proper overlap (back-to-front)
      trees.sort((a, b) => a.ty - b.ty);

      const palette = getOrchardPalette(season, seed);

      // Shadow pass (skip winter — bare branches don't cast much shadow)
      if (season !== Season.Winter) {
        for (const tree of trees) {
          const tmpl = ORCHARD_TEMPLATES[tree.templateIdx];
          const sw = Math.ceil(tmpl.w * 0.7);
          const sh = Math.max(1, Math.ceil(tmpl.h * 0.25));
          const sx = tree.tx + 1 - Math.floor(sw / 2);
          const sy = tree.ty;
          for (let dy = 0; dy < sh; dy++) {
            for (let dx = 0; dx < sw; dx++) {
              const px = sx + dx;
              const py = sy + dy;
              if (px < 0 || px >= N || py < 0 || py >= N) continue;
              const ex = (dx - sw / 2) / (sw / 2);
              const ey = (dy - sh / 2) / (sh / 2);
              if (ex * ex + ey * ey > 1.0) continue;
              const idx = py * N + px;
              pixels[idx] = _darkenPixel(pixels[idx], 0.55);
            }
          }
        }
      }

      // Sprite pass — bare branches in winter, leafed canopies other seasons
      for (const tree of trees) {
        const tmpl = season === Season.Winter
          ? ORCHARD_BARE_TEMPLATES[tree.templateIdx % ORCHARD_BARE_TEMPLATES.length]
          : ORCHARD_TEMPLATES[tree.templateIdx];
        this._stampOrchardTree(pixels, N, tree.tx, tree.ty, tmpl, palette, tree.flipped, season, seed);
      }
    }
  }

  private _stampOrchardTree(
    pixels: Uint32Array, N: number,
    tx: number, ty: number,
    tmpl: { w: number; h: number; data: number[] },
    palette: OrchardPalette,
    flipped: boolean,
    season: Season,
    seed: number,
  ): void {
    const { w, h, data } = tmpl;
    const startX = tx - Math.floor(w / 2);
    const startY = ty - h + 1;

    // Canopy bounding box for lighting
    let cMinX = w, cMaxX = 0, cMinY = h, cMaxY = 0;
    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < w; sx++) {
        if (data[sy * w + sx] === 2) {
          cMinX = Math.min(cMinX, sx); cMaxX = Math.max(cMaxX, sx);
          cMinY = Math.min(cMinY, sy); cMaxY = Math.max(cMaxY, sy);
        }
      }
    }
    const canopyCX = (cMinX + cMaxX) / 2;
    const canopyCY = (cMinY + cMaxY) / 2;
    const canopyRadX = Math.max(1, (cMaxX - cMinX) / 2);
    const canopyRadY = Math.max(1, (cMaxY - cMinY) / 2);

    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < w; sx++) {
        const srcX = flipped ? (w - 1 - sx) : sx;
        const cell = data[sy * w + srcX];
        if (cell === 0) continue;

        const px = startX + sx;
        const py = startY + sy;
        if (px < 0 || px >= N || py < 0 || py >= N) continue;

        let color: number;
        if (cell === 1) {
          // Trunk: left lighter, right darker
          const trunkMid = Math.floor(w / 2);
          const localX = flipped ? (w - 1 - sx) : sx;
          color = localX <= trunkMid ? palette.trunk[0] : palette.trunk[1];
        } else {
          // Canopy: 5-shade directional lighting
          const relX = (srcX - canopyCX) / canopyRadX;
          const relY = (sy - canopyCY) / canopyRadY;
          const lightDot = relX * ORCHARD_LIGHT_X + relY * ORCHARD_LIGHT_Y;
          let shadeIdx = Math.max(0, Math.min(4, Math.floor((lightDot + 1) / 2 * 4.99)));

          // Fall: single-pixel red apples on every tree, evenly distributed
          if (season === Season.Fall && shadeIdx >= 2) {
            const appleHash = mulberry32((px * 7919 + py * 104729) ^ seed ^ 0xa991e)();
            if (appleHash < 0.10) {
              color = palette.apple!;
              const r = (color >> 16) & 0xff;
              const g = (color >> 8) & 0xff;
              const b = color & 0xff;
              pixels[py * N + px] = packABGR(r, g, b);
              continue;
            }
          }

          // Spring: scatter blossom pixels — heavy pink/white
          if (season === Season.Spring && shadeIdx >= 2) {
            const blossomHash = mulberry32((px * 7919 + py * 104729) ^ seed ^ 0xb10550)();
            if (blossomHash < 0.50) {
              color = blossomHash < 0.20 ? 0xf8d0e0 : blossomHash < 0.35 ? 0xf0a8c0 : 0xe8d8e8;
              const r = (color >> 16) & 0xff;
              const g = (color >> 8) & 0xff;
              const b = color & 0xff;
              pixels[py * N + px] = packABGR(r, g, b);
              continue;
            }
          }

          color = palette.canopy[shadeIdx];
        }

        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;
        pixels[py * N + px] = packABGR(r, g, b);
      }
    }
  }

}
