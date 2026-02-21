import type { TileType } from '../../types';

export const TILE_SIZE = 64;
export const NUM_TILE_VARIANTS = 8;
export const SEASON_COUNT = 4; // 0=spring 1=summer 2=fall 3=winter

/** Maps a 1-based turn number to a season index 0–3, cycling every 4 turns. */
export function getSeasonIndex(turnNumber: number): number {
  return (Math.max(1, turnNumber) - 1) % SEASON_COUNT;
}

// ─── Seeded RNG ──────────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function radialPatch(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number, rgba: string,
) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Tree palettes ────────────────────────────────────────────────────────────
interface TreePalette { base: string; mid: string; hi: string; trunk: string; }

// Spring: fresh greens + cherry blossom
const SPRING_PALETTES: TreePalette[] = [
  { base: '#2d6a2d', mid: '#4a9440', hi: '#7abf50', trunk: '#5a3a1a' },
  { base: '#3a7228', mid: '#58a040', hi: '#8ad458', trunk: '#4a3218' },
  { base: '#2d6040', mid: '#3e8a58', hi: '#60b878', trunk: '#3a2a18' },
  { base: '#7a3868', mid: '#b05888', hi: '#e090b8', trunk: '#5a2a40' }, // cherry blossom
];
// Summer: rich deep greens
const SUMMER_PALETTES: TreePalette[] = [
  { base: '#1a5a1a', mid: '#2d8030', hi: '#5aad40', trunk: '#4a3218' },
  { base: '#245a18', mid: '#388a28', hi: '#60b040', trunk: '#3e2814' },
  { base: '#2d6a2d', mid: '#4a9440', hi: '#7abf50', trunk: '#5a3a1a' },
  { base: '#2d6040', mid: '#3e8a58', hi: '#60b878', trunk: '#3a2a18' },
];
// Fall: orange, red, yellow, brown — orange belongs here, not spring/summer
const FALL_PALETTES: TreePalette[] = [
  { base: '#8a3a10', mid: '#c05a20', hi: '#e88030', trunk: '#5a2e10' }, // orange
  { base: '#8a2010', mid: '#b04020', hi: '#d06030', trunk: '#5a2010' }, // red
  { base: '#8a7a10', mid: '#c0a820', hi: '#e8c830', trunk: '#5a4a10' }, // golden yellow
  { base: '#6a4a10', mid: '#8a6a30', hi: '#b08040', trunk: '#4a3010' }, // amber-brown
];
const SEASON_PALETTES = [SPRING_PALETTES, SUMMER_PALETTES, FALL_PALETTES, [] /* winter: bare */];

// ─── Tree drawing ─────────────────────────────────────────────────────────────
function drawBroadleafTree(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  p: TreePalette, rng: () => number,
) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 4, radius * 0.88, radius * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.trunk;
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius * 0.3, radius * 0.22, radius * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.base;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const blobCount = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < blobCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * radius * 0.5;
    const br = radius * (0.28 + rng() * 0.3);
    ctx.fillStyle = p.mid;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, br, 0, Math.PI * 2);
    ctx.fill();
  }

  const hlG = ctx.createRadialGradient(cx - radius * 0.32, cy - radius * 0.36, 0, cx, cy, radius);
  hlG.addColorStop(0, hexToRgba(p.hi, 0.75));
  hlG.addColorStop(0.5, hexToRgba(p.hi, 0.2));
  hlG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hlG;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const shG = ctx.createRadialGradient(cx + radius * 0.28, cy + radius * 0.32, 0, cx, cy, radius);
  shG.addColorStop(0, 'rgba(0,20,0,0.45)');
  shG.addColorStop(0.5, 'rgba(0,0,0,0)');
  shG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shG;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawConifer(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rng: () => number, snowCap = false,
) {
  const h = 26 + rng() * 14;
  const w = h * 0.42;

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + h * 0.42, w * 0.85, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a4a38';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.5);
  ctx.lineTo(cx - w, cy + h * 0.42);
  ctx.lineTo(cx + w, cy + h * 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2a6a50';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.48);
  ctx.lineTo(cx - w * 0.68, cy + h * 0.26);
  ctx.lineTo(cx + w * 0.68, cy + h * 0.26);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(70,160,115,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.46);
  ctx.lineTo(cx - w * 0.32, cy);
  ctx.lineTo(cx + w * 0.32, cy);
  ctx.closePath();
  ctx.fill();

  if (snowCap) {
    ctx.fillStyle = 'rgba(225,238,255,0.72)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.5 + 1);
    ctx.lineTo(cx - w * 0.48, cy - h * 0.14);
    ctx.lineTo(cx + w * 0.48, cy - h * 0.14);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBareTree(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rng: () => number,
) {
  const h = 22 + rng() * 12;
  const tw = 2.5 + rng() * 1.5;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + h * 0.5, tw + 2, tw * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3a2a16';
  ctx.fillRect(cx - tw / 2, cy - h * 0.5, tw, h);

  const numBranches = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < numBranches; i++) {
    const by = cy - h * 0.5 + h * (0.15 + rng() * 0.75);
    const bLen = 7 + rng() * 12;
    const dir = rng() > 0.5 ? 1 : -1;

    ctx.strokeStyle = '#3a2a16';
    ctx.lineWidth = 1 + rng() * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.lineTo(cx + dir * bLen, by - 3 - rng() * 6);
    ctx.stroke();

    if (rng() < 0.5) {
      const subX = cx + dir * bLen * 0.6;
      const subY = by - 2 - rng() * 3;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(subX, subY);
      ctx.lineTo(subX + dir * (4 + rng() * 6), subY - 3 - rng() * 4);
      ctx.stroke();
    }
  }
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number, rng: () => number,
) {
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 3, size * 1.05, size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#898070';
  ctx.beginPath();
  ctx.ellipse(cx, cy, size, size * 0.72, rng() * 0.6, 0, Math.PI * 2);
  ctx.fill();

  const hlG = ctx.createRadialGradient(cx - size * 0.32, cy - size * 0.32, 0, cx, cy, size);
  hlG.addColorStop(0, 'rgba(205,198,180,0.72)');
  hlG.addColorStop(0.65, 'rgba(160,155,140,0)');
  hlG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hlG;
  ctx.beginPath();
  ctx.ellipse(cx, cy, size, size * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Biome drawers ────────────────────────────────────────────────────────────
function drawOcean(ctx: CanvasRenderingContext2D, size: number, rng: () => number, season: number, _layoutRng: () => number) {
  // Winter: dark stormy; Fall: slightly darker; Spring/Summer: bright blue
  const [c0, c1] = season === 3
    ? ['#0e2a58', '#163478']
    : season === 2
      ? ['#153c70', '#1a5088']
      : ['#194a8a', '#2060aa'];

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, c0);
  bg.addColorStop(1, c1);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 8; i++) {
    radialPatch(ctx, rng() * size, rng() * size, 6 + rng() * 14,
      `rgba(60,130,200,${(0.12 + rng() * 0.16).toFixed(2)})`);
  }

  const waveAlpha = season === 3 ? 0.5 : 0.35;
  ctx.strokeStyle = `rgba(140,200,255,${waveAlpha})`;
  ctx.lineWidth = season === 3 ? 1.5 : 1;
  for (let i = 0; i < 5; i++) {
    const wy = rng() * size;
    const wx = rng() * (size - 16);
    const len = 8 + rng() * 14;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + len * 0.5, wy - 2 - rng() * 2, wx + len, wy);
    ctx.stroke();
  }

  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = `rgba(180,230,255,${(0.15 + rng() * 0.3).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, 0.4 + rng() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCoast(ctx: CanvasRenderingContext2D, size: number, rng: () => number, season: number, _layoutRng: () => number) {
  // Winter: greyish sand; otherwise warm sand
  const base = season === 3 ? '#a89878' : '#c8a460';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 18; i++) {
    const light = rng() > 0.5;
    const lightC = season === 3 ? 'rgba(190,178,158,0.35)' : `rgba(225,190,118,${(0.3 + rng() * 0.32).toFixed(2)})`;
    const darkC  = season === 3 ? 'rgba(130,112,88,0.3)'  : `rgba(155,115,58,${(0.2 + rng() * 0.25).toFixed(2)})`;
    radialPatch(ctx, rng() * size, rng() * size, 3 + rng() * 9, light ? lightC : darkC);
  }

  const rockCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < rockCount; i++) {
    drawRock(ctx, 8 + rng() * (size - 16), 8 + rng() * (size - 16), 4 + rng() * 6, rng);
  }

  if (season === 3) {
    // Frost patches
    for (let i = 0; i < 5; i++) {
      radialPatch(ctx, rng() * size, rng() * size, 4 + rng() * 8,
        `rgba(220,235,255,${(0.25 + rng() * 0.25).toFixed(2)})`);
    }
  }
}

function drawPlains(ctx: CanvasRenderingContext2D, size: number, rng: () => number, season: number, _layoutRng: () => number) {
  const bases = ['#5a9a30', '#4a8820', '#8a7820', '#585f54'];
  ctx.fillStyle = bases[season];
  ctx.fillRect(0, 0, size, size);

  if (season === 3) {
    // Winter: snow blanket
    for (let i = 0; i < 10; i++) {
      radialPatch(ctx, rng() * size, rng() * size, 5 + rng() * 14,
        `rgba(215,230,245,${(0.35 + rng() * 0.38).toFixed(2)})`);
    }
    if (rng() < 0.25) drawRock(ctx, 8 + rng() * (size - 16), 8 + rng() * (size - 16), 3 + rng() * 4, rng);
    return;
  }

  // Green/dry texture patches
  const patchColors: [string, string][] = [
    ['rgba(110,190,50,%.2f)', 'rgba(38,108,14,%.2f)'],   // spring
    ['rgba(85,152,35,%.2f)',  'rgba(28,88,10,%.2f)'],    // summer
    ['rgba(158,148,38,%.2f)', 'rgba(98,78,8,%.2f)'],     // fall
    ['rgba(0,0,0,0)',         'rgba(0,0,0,0)'],            // (winter handled above)
  ];
  const [lc, dc] = patchColors[season];
  for (let i = 0; i < 14; i++) {
    const lighter = rng() > 0.45;
    const a = (0.24 + rng() * 0.3).toFixed(2);
    radialPatch(ctx, rng() * size, rng() * size, 5 + rng() * 13,
      lighter ? lc.replace('%.2f', a) : dc.replace('%.2f', a));
  }

  // Fall leaf scatter on ground
  if (season === 2) {
    for (let i = 0; i < 6; i++) {
      radialPatch(ctx, rng() * size, rng() * size, 3 + rng() * 8,
        `rgba(195,155,45,${(0.2 + rng() * 0.25).toFixed(2)})`);
    }
  }

  // Flowers (spring abundant, summer sparse, fall none)
  const maxFlowers = [5 + Math.floor(rng() * 5), 1 + Math.floor(rng() * 2), 0, 0][season];
  const FLOWER_COLORS = ['rgba(220,50,50,0.88)', 'rgba(255,240,80,0.82)', 'rgba(255,255,255,0.88)', 'rgba(180,100,255,0.72)'];
  for (let i = 0; i < maxFlowers; i++) {
    ctx.fillStyle = FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)];
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, 0.8 + rng() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (rng() < 0.25) drawRock(ctx, 8 + rng() * (size - 16), 8 + rng() * (size - 16), 3 + rng() * 4, rng);
}

function drawForest(ctx: CanvasRenderingContext2D, size: number, rng: () => number, season: number, layoutRng: () => number) {
  const floors = ['#2a4a1a', '#1e3a14', '#3a2a10', '#2a2a22'];
  ctx.fillStyle = floors[season];
  ctx.fillRect(0, 0, size, size);

  // Floor texture — uses rng (season-dependent visuals, not layout)
  const floorPatch = season === 2
    ? `rgba(140,90,20,%.2f)`  // fall: earthy brown
    : season === 3
      ? `rgba(50,50,45,%.2f)` // winter: dark grey
      : `rgba(70,120,30,%.2f)`;
  for (let i = 0; i < 10; i++) {
    const a = (0.18 + rng() * 0.3).toFixed(2);
    radialPatch(ctx, rng() * size, rng() * size, 4 + rng() * 10, floorPatch.replace('%.2f', a));
  }

  // Winter ground snow — uses rng, season-specific, does NOT affect layoutRng
  if (season === 3) {
    for (let i = 0; i < 5; i++) {
      radialPatch(ctx, rng() * size, rng() * size, 4 + rng() * 10,
        `rgba(210,225,245,${(0.25 + rng() * 0.3).toFixed(2)})`);
    }
  }

  // Trees — layoutRng drives all spatial decisions so positions/types are
  // identical across every season. Each tree consumes exactly 5 layoutRng calls
  // regardless of its type, keeping subsequent trees stable too.
  const treeCount = 2 + Math.floor(layoutRng() * 2);
  const palettes = SEASON_PALETTES[season];
  // Fallback palette for when palettes is empty (winter broadleaf — never rendered)
  const fallbackPalette = SUMMER_PALETTES;

  for (let i = 0; i < treeCount; i++) {
    const tx        = size * (0.18 + layoutRng() * 0.64); // call 1
    const ty        = size * (0.18 + layoutRng() * 0.64); // call 2
    const isConifer = layoutRng() < 0.3;                  // call 3
    const palIdx    = Math.floor(layoutRng() * 4);         // call 4 (always consumed)
    const treeSize  = 18 + layoutRng() * 11;               // call 5

    if (isConifer) {
      // Conifers are evergreen; show snow cap only in winter
      drawConifer(ctx, tx, ty, rng, season === 3);
    } else if (season === 3) {
      // Deciduous trees go bare in winter
      drawBareTree(ctx, tx, ty, rng);
    } else {
      const pal = palettes.length > 0 ? palettes[palIdx % palettes.length] : fallbackPalette[palIdx % fallbackPalette.length];
      drawBroadleafTree(ctx, tx, ty, treeSize, pal, rng);
    }
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, size: number, rng: () => number, season: number, _layoutRng: () => number) {
  // Winter: lighter grey-white base; Summer: bare rocky
  const base = season === 3 ? '#909090' : '#7a7060';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const patchCount = season === 3 ? 6 : 12;
  for (let i = 0; i < patchCount; i++) {
    const light = rng() > 0.5;
    radialPatch(ctx, rng() * size, rng() * size, 4 + rng() * 12,
      light
        ? `rgba(178,168,152,${(0.3 + rng() * 0.35).toFixed(2)})`
        : `rgba(48,43,36,${(0.22 + rng() * 0.28).toFixed(2)})`);
  }

  // Snow patches — heavy in winter, partial in spring/fall, none in summer
  const snowPatchCount = [3, 0, 2, 14][season];
  const snowBase = season === 3 ? 0.55 : 0.28;
  for (let i = 0; i < snowPatchCount; i++) {
    const cx = season === 3 ? rng() * size : rng() * size * 0.8 + size * 0.1;
    const cy = season === 3 ? rng() * size : rng() * size * 0.6;
    radialPatch(ctx, cx, cy, 6 + rng() * 16,
      `rgba(228,238,255,${(snowBase + rng() * 0.35).toFixed(2)})`);
  }

  const boulderCount = season === 3 ? 1 : 2 + Math.floor(rng() * 3);
  for (let i = 0; i < boulderCount; i++) {
    drawRock(ctx, 8 + rng() * (size - 16), 8 + rng() * (size - 16), 5 + rng() * 9, rng);
  }

  ctx.strokeStyle = 'rgba(38,34,26,0.5)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 5; i++) {
    const sx = rng() * size;
    const sy = rng() * size;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (rng() - 0.5) * 18, sy + (rng() - 0.5) * 14);
    ctx.stroke();
  }
}

function drawWetland(ctx: CanvasRenderingContext2D, size: number, rng: () => number, season: number, _layoutRng: () => number) {
  const bases = ['#3a6040', '#3a5838', '#4a3820', '#404848'];
  ctx.fillStyle = bases[season];
  ctx.fillRect(0, 0, size, size);

  // Muddy/ground texture
  for (let i = 0; i < 10; i++) {
    const rf = Math.floor(80 + rng() * 40);
    const gf = season === 2 ? Math.floor(55 + rng() * 25) : Math.floor(70 + rng() * 30);
    const bf = Math.floor(30 + rng() * 20);
    radialPatch(ctx, rng() * size, rng() * size, 4 + rng() * 10,
      `rgba(${rf},${gf},${bf},${(0.24 + rng() * 0.3).toFixed(2)})`);
  }

  const poolCount = season === 0 ? 2 + Math.floor(rng() * 3) // spring: many pools
                  : season === 1 ? 1 + Math.floor(rng() * 2) // summer: fewer
                  : season === 2 ? Math.floor(rng() * 2)     // fall: sparse
                  : 1 + Math.floor(rng() * 2);               // winter: ice pools
  for (let i = 0; i < poolCount; i++) {
    const px = 8 + rng() * (size - 16);
    const py = 8 + rng() * (size - 16);
    const prx = 6 + rng() * 10;
    const pry = 3 + rng() * 6;
    // Winter: frozen (pale ice blue); otherwise regular water
    const poolColor = season === 3
      ? 'rgba(170,210,230,0.55)'
      : 'rgba(40,90,140,0.55)';
    const hlColor   = season === 3
      ? 'rgba(220,240,255,0.45)'
      : 'rgba(100,180,220,0.3)';
    ctx.fillStyle = poolColor;
    ctx.beginPath();
    ctx.ellipse(px, py, prx, pry, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hlColor;
    ctx.beginPath();
    ctx.ellipse(px - prx * 0.22, py - pry * 0.22, prx * 0.48, pry * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Winter: snow on ground
  if (season === 3) {
    for (let i = 0; i < 6; i++) {
      radialPatch(ctx, rng() * size, rng() * size, 4 + rng() * 9,
        `rgba(215,230,245,${(0.3 + rng() * 0.3).toFixed(2)})`);
    }
  }

  // Reeds (fewer in fall/winter)
  const reedCount = [8, 6, 3, 2][season];
  ctx.strokeStyle = season === 2 ? 'rgba(140,110,50,0.6)' : 'rgba(110,170,80,0.65)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < reedCount; i++) {
    const rx = rng() * size;
    const ry = rng() * size;
    ctx.beginPath();
    ctx.moveTo(rx, ry + 4);
    ctx.lineTo(rx + (rng() - 0.5) * 4, ry - 5 - rng() * 5);
    ctx.stroke();
  }
}

function drawDesert(ctx: CanvasRenderingContext2D, size: number, rng: () => number, season: number, _layoutRng: () => number) {
  // Winter: slightly cooler sand
  const base = season === 3 ? '#b89060' : '#d4a040';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 12; i++) {
    const light = rng() > 0.5;
    radialPatch(ctx, rng() * size, rng() * size, 5 + rng() * 14,
      light
        ? `rgba(230,195,120,${(0.3 + rng() * 0.3).toFixed(2)})`
        : `rgba(158,108,38,${(0.2 + rng() * 0.25).toFixed(2)})`);
  }

  ctx.lineWidth = 0.8;
  for (let i = 0; i < 6; i++) {
    const lineY = rng() * size;
    const r2 = Math.floor(182 + rng() * 38);
    const g2 = Math.floor(132 + rng() * 28);
    const b2 = Math.floor(52 + rng() * 20);
    ctx.strokeStyle = `rgba(${r2},${g2},${b2},${(0.22 + rng() * 0.2).toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.bezierCurveTo(size * 0.33, lineY + (rng() - 0.5) * 8, size * 0.66, lineY + (rng() - 0.5) * 8, size, lineY + (rng() - 0.5) * 5);
    ctx.stroke();
  }

  const pebbleCount = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < pebbleCount; i++) {
    ctx.fillStyle = `rgba(${Math.floor(142 + rng() * 38)},${Math.floor(112 + rng() * 24)},${Math.floor(62 + rng() * 20)},${(0.48 + rng() * 0.3).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size, 1.5 + rng() * 3.5, 0.8 + rng() * 2.2, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Winter: frost patches
  if (season === 3) {
    for (let i = 0; i < 4; i++) {
      radialPatch(ctx, rng() * size, rng() * size, 5 + rng() * 10,
        `rgba(210,225,240,${(0.2 + rng() * 0.2).toFixed(2)})`);
    }
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
// layoutRng is a season-independent RNG used for stable spatial layout (tree
// positions, counts, types) so that seasonal changes never relocate decorations.
type DrawFn = (ctx: CanvasRenderingContext2D, size: number, rng: () => number, season: number, layoutRng: () => number) => void;

const BIOME_DRAWERS: Record<TileType, DrawFn> = {
  ocean:    drawOcean,
  coast:    drawCoast,
  plains:   drawPlains,
  forest:   drawForest,
  mountain: drawMountain,
  wetland:  drawWetland,
  desert:   drawDesert,
};

/**
 * Generates all season×variant textures for all biomes.
 * Keys are `${biomeType}-s${seasonIndex}-v${variantIndex}`.
 */
export function generateAllSeasonVariants(tileSize: number): Map<string, HTMLCanvasElement> {
  const result = new Map<string, HTMLCanvasElement>();
  for (const [type, drawFn] of Object.entries(BIOME_DRAWERS) as [TileType, DrawFn][]) {
    const typeSeed = type.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1) * 31, 0);
    for (let season = 0; season < SEASON_COUNT; season++) {
      for (let v = 0; v < NUM_TILE_VARIANTS; v++) {
        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const ctx = canvas.getContext('2d')!;
        // rng: season-independent seed for decorative details (visual variation)
        const rng = mulberry32(typeSeed * 137 + v * 1009);
        // layoutRng: same base seed but different multiplier — used exclusively for
        // spatial layout (tree positions, counts, types) so seasons don't move trees.
        const layoutRng = mulberry32(typeSeed * 2971 + v * 6737);
        drawFn(ctx, tileSize, rng, season, layoutRng);
        result.set(`${type}-s${season}-v${v}`, canvas);
      }
    }
  }
  return result;
}
