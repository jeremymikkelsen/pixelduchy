import type { TileType } from '../../types';

export const TILE_SIZE = 64;
export const NUM_TILE_VARIANTS = 8;

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

// ─── Shared primitives ────────────────────────────────────────────────────────
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

// ─── Tree drawing ─────────────────────────────────────────────────────────────
interface TreePalette { base: string; mid: string; hi: string; trunk: string; }

function drawBroadleafTree(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  p: TreePalette,
  rng: () => number,
) {
  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 4, radius * 0.88, radius * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk nub (visible at base of canopy)
  ctx.fillStyle = p.trunk;
  ctx.beginPath();
  ctx.ellipse(cx, cy + radius * 0.3, radius * 0.22, radius * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Base canopy disk
  ctx.fillStyle = p.base;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Mid-tone blobs for canopy depth
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

  // Sun highlight (top-left)
  const hlG = ctx.createRadialGradient(cx - radius * 0.32, cy - radius * 0.36, 0, cx, cy, radius);
  hlG.addColorStop(0, hexToRgba(p.hi, 0.75));
  hlG.addColorStop(0.5, hexToRgba(p.hi, 0.2));
  hlG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hlG;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Cast shadow (bottom-right)
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
  rng: () => number,
) {
  const h = 26 + rng() * 14;
  const w = h * 0.42;

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + h * 0.42, w * 0.85, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dark base triangle
  ctx.fillStyle = '#1a4a38';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.5);
  ctx.lineTo(cx - w, cy + h * 0.42);
  ctx.lineTo(cx + w, cy + h * 0.42);
  ctx.closePath();
  ctx.fill();

  // Mid-green layer (slightly narrower, shifted up)
  ctx.fillStyle = '#2a6a50';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.48);
  ctx.lineTo(cx - w * 0.68, cy + h * 0.26);
  ctx.lineTo(cx + w * 0.68, cy + h * 0.26);
  ctx.closePath();
  ctx.fill();

  // Top highlight
  ctx.fillStyle = 'rgba(70,160,115,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.46);
  ctx.lineTo(cx - w * 0.32, cy);
  ctx.lineTo(cx + w * 0.32, cy);
  ctx.closePath();
  ctx.fill();
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, size: number,
  rng: () => number,
) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 3, size * 1.05, size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rock body
  ctx.fillStyle = '#898070';
  ctx.beginPath();
  ctx.ellipse(cx, cy, size, size * 0.72, rng() * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Lit face (top-left)
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
function drawOcean(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, '#194a8a');
  bg.addColorStop(0.6, '#2060aa');
  bg.addColorStop(1, '#185090');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 8; i++) {
    radialPatch(ctx, rng() * size, rng() * size, 6 + rng() * 14,
      `rgba(60,130,200,${(0.14 + rng() * 0.18).toFixed(2)})`);
  }

  ctx.strokeStyle = 'rgba(140,200,255,0.35)';
  ctx.lineWidth = 1;
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

function drawCoast(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  ctx.fillStyle = '#c8a460';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 18; i++) {
    const light = rng() > 0.5;
    radialPatch(ctx, rng() * size, rng() * size, 3 + rng() * 9,
      light
        ? `rgba(225,190,118,${(0.3 + rng() * 0.32).toFixed(2)})`
        : `rgba(155,115,58,${(0.2 + rng() * 0.25).toFixed(2)})`);
  }

  const rockCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < rockCount; i++) {
    drawRock(ctx, 8 + rng() * (size - 16), 8 + rng() * (size - 16), 4 + rng() * 6, rng);
  }
}

function drawPlains(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  ctx.fillStyle = '#5a9a30';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 14; i++) {
    const lighter = rng() > 0.45;
    radialPatch(ctx, rng() * size, rng() * size, 5 + rng() * 13,
      lighter
        ? `rgba(110,190,50,${(0.24 + rng() * 0.3).toFixed(2)})`
        : `rgba(38,108,14,${(0.2 + rng() * 0.25).toFixed(2)})`);
  }

  const FLOWER_COLORS = [
    'rgba(220,50,50,0.88)',
    'rgba(255,240,80,0.82)',
    'rgba(255,255,255,0.88)',
    'rgba(180,100,255,0.72)',
  ];
  const flowerCount = 2 + Math.floor(rng() * 6);
  for (let i = 0; i < flowerCount; i++) {
    ctx.fillStyle = FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)];
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, 0.8 + rng() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (rng() < 0.25) {
    drawRock(ctx, 8 + rng() * (size - 16), 8 + rng() * (size - 16), 3 + rng() * 4, rng);
  }
}

const BROADLEAF_PALETTES: TreePalette[] = [
  { base: '#2d6a2d', mid: '#4a9440', hi: '#7abf50', trunk: '#5a3a1a' },
  { base: '#4a7a1a', mid: '#72b030', hi: '#a8d850', trunk: '#4a3a18' },
  { base: '#8a3a10', mid: '#c05a20', hi: '#e88030', trunk: '#5a2e10' },
  { base: '#2d6040', mid: '#3e8a58', hi: '#60b878', trunk: '#3a2a18' },
];

function drawForest(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  ctx.fillStyle = '#2a4a1a';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 10; i++) {
    radialPatch(ctx, rng() * size, rng() * size, 4 + rng() * 10,
      `rgba(70,120,30,${(0.18 + rng() * 0.3).toFixed(2)})`);
  }

  const treeCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < treeCount; i++) {
    const tx = size * (0.18 + rng() * 0.64);
    const ty = size * (0.18 + rng() * 0.64);
    if (rng() < 0.32) {
      drawConifer(ctx, tx, ty, rng);
    } else {
      const palette = BROADLEAF_PALETTES[Math.floor(rng() * BROADLEAF_PALETTES.length)];
      drawBroadleafTree(ctx, tx, ty, 18 + rng() * 11, palette, rng);
    }
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  ctx.fillStyle = '#7a7060';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 12; i++) {
    const light = rng() > 0.5;
    radialPatch(ctx, rng() * size, rng() * size, 4 + rng() * 12,
      light
        ? `rgba(178,168,152,${(0.3 + rng() * 0.35).toFixed(2)})`
        : `rgba(48,43,36,${(0.22 + rng() * 0.28).toFixed(2)})`);
  }

  const boulderCount = 2 + Math.floor(rng() * 3);
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

function drawWetland(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  ctx.fillStyle = '#3a6040';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 10; i++) {
    const r = Math.floor(80 + rng() * 40);
    const g = Math.floor(70 + rng() * 30);
    const b = Math.floor(30 + rng() * 20);
    radialPatch(ctx, rng() * size, rng() * size, 4 + rng() * 10,
      `rgba(${r},${g},${b},${(0.24 + rng() * 0.3).toFixed(2)})`);
  }

  const poolCount = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < poolCount; i++) {
    const px = 8 + rng() * (size - 16);
    const py = 8 + rng() * (size - 16);
    const prx = 6 + rng() * 10;
    const pry = 3 + rng() * 6;
    ctx.fillStyle = 'rgba(40,90,140,0.55)';
    ctx.beginPath();
    ctx.ellipse(px, py, prx, pry, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(100,180,220,0.3)';
    ctx.beginPath();
    ctx.ellipse(px - prx * 0.22, py - pry * 0.22, prx * 0.48, pry * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(110,170,80,0.65)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 8; i++) {
    const rx = rng() * size;
    const ry = rng() * size;
    ctx.beginPath();
    ctx.moveTo(rx, ry + 4);
    ctx.lineTo(rx + (rng() - 0.5) * 4, ry - 5 - rng() * 5);
    ctx.stroke();
  }
}

function drawDesert(ctx: CanvasRenderingContext2D, size: number, rng: () => number) {
  ctx.fillStyle = '#d4a040';
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
    const r = Math.floor(182 + rng() * 38);
    const g = Math.floor(132 + rng() * 28);
    const b = Math.floor(52 + rng() * 20);
    ctx.strokeStyle = `rgba(${r},${g},${b},${(0.22 + rng() * 0.2).toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.bezierCurveTo(
      size * 0.33, lineY + (rng() - 0.5) * 8,
      size * 0.66, lineY + (rng() - 0.5) * 8,
      size, lineY + (rng() - 0.5) * 5,
    );
    ctx.stroke();
  }

  const pebbleCount = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < pebbleCount; i++) {
    ctx.fillStyle = `rgba(${Math.floor(142 + rng() * 38)},${Math.floor(112 + rng() * 24)},${Math.floor(62 + rng() * 20)},${(0.48 + rng() * 0.3).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size, 1.5 + rng() * 3.5, 0.8 + rng() * 2.2, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
type DrawFn = (ctx: CanvasRenderingContext2D, size: number, rng: () => number) => void;

const BIOME_DRAWERS: Record<TileType, DrawFn> = {
  ocean:    drawOcean,
  coast:    drawCoast,
  plains:   drawPlains,
  forest:   drawForest,
  mountain: drawMountain,
  wetland:  drawWetland,
  desert:   drawDesert,
};

export function generateTileVariants(tileSize: number): Map<TileType, HTMLCanvasElement[]> {
  const result = new Map<TileType, HTMLCanvasElement[]>();
  for (const [type, drawFn] of Object.entries(BIOME_DRAWERS) as [TileType, DrawFn][]) {
    const variants: HTMLCanvasElement[] = [];
    for (let v = 0; v < NUM_TILE_VARIANTS; v++) {
      const canvas = document.createElement('canvas');
      canvas.width = tileSize;
      canvas.height = tileSize;
      const ctx = canvas.getContext('2d')!;
      // Combine stable type hash + variant index for repeatable unique seeds
      const typeSeed = type.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1) * 31, 0);
      const rng = mulberry32(typeSeed * 137 + v * 1009);
      drawFn(ctx, tileSize, rng);
      variants.push(canvas);
    }
    result.set(type, variants);
  }
  return result;
}
