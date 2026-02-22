import type { BuildingType } from '../../types';

type DrawFn = (ctx: CanvasRenderingContext2D, s: number) => void;

const π = Math.PI;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function dropShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 4, rx, ry, 0, 0, π * 2);
  ctx.fill();
}

function doorPx(
  ctx: CanvasRenderingContext2D,
  cx: number, y: number, w: number, h: number,
  color = '#5a3010', inner = '#7a5030',
) {
  ctx.fillStyle = color;
  ctx.fillRect(cx - w / 2, y, w, h);
  ctx.fillStyle = inner;
  ctx.fillRect(cx - w / 2 + 1.5, y + 1.5, w - 3, h - 1.5);
  ctx.fillStyle = '#d4a840';
  ctx.fillRect(cx + w / 2 - 3.5, y + h * 0.45, 2, 2);
}

function windowPx(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#5a4020';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#80b8d8';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(x + 1, y + 1, (w - 2) / 2, (h - 2) / 2);
}

// ─── Gabled building helper ───────────────────────────────────────────────────

interface GabledOpts {
  rf: string;   // roof front slope color
  rb: string;   // roof back slope / gable color
  rr: string;   // roof ridge highlight
  wc: string;   // wall color
  bwf?: number; // building width factor (default 0.61)
  whf?: number; // wall height factor (default 0.13)
  detail?: (ctx: CanvasRenderingContext2D, cx: number, eavesY: number, wallBotY: number, eavesW: number) => void;
}

interface GL {
  cx: number; topY: number; ridgeY: number;
  eavesY: number; wallBotY: number;
  eavesW: number; ridgeW: number; backW: number;
}

function drawGabled(ctx: CanvasRenderingContext2D, s: number, opts: GabledOpts): GL {
  const cx    = s / 2;
  const bwf   = opts.bwf ?? 0.61;
  const whf   = opts.whf ?? 0.13;
  const topY     = s * 0.17;
  const ridgeY   = s * 0.33;
  const eavesY   = s * 0.51;
  const wallBotY = eavesY + s * whf;
  const backW    = s * 0.44;
  const ridgeW   = s * bwf * 0.73;
  const eavesW   = s * bwf;

  dropShadow(ctx, cx, wallBotY, eavesW * 0.46, s * 0.048);

  // Back slope (darker, receding)
  ctx.fillStyle = opts.rb;
  ctx.beginPath();
  ctx.moveTo(cx - backW / 2, topY);
  ctx.lineTo(cx + backW / 2, topY);
  ctx.lineTo(cx + ridgeW / 2, ridgeY);
  ctx.lineTo(cx - ridgeW / 2, ridgeY);
  ctx.closePath();
  ctx.fill();

  // Front slope (main visible face)
  ctx.fillStyle = opts.rf;
  ctx.beginPath();
  ctx.moveTo(cx - ridgeW / 2, ridgeY);
  ctx.lineTo(cx + ridgeW / 2, ridgeY);
  ctx.lineTo(cx + eavesW / 2, eavesY);
  ctx.lineTo(cx - eavesW / 2, eavesY);
  ctx.closePath();
  ctx.fill();

  // Tile row lines on front slope
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.9;
  for (let i = 1; i <= 4; i++) {
    const t   = i / 5;
    const ly  = ridgeY + (eavesY - ridgeY) * t;
    const lw  = ridgeW + (eavesW - ridgeW) * t;
    ctx.beginPath();
    ctx.moveTo(cx - lw / 2, ly);
    ctx.lineTo(cx + lw / 2, ly);
    ctx.stroke();
  }

  // Ridge highlight
  ctx.strokeStyle = opts.rr;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - ridgeW / 2, ridgeY);
  ctx.lineTo(cx + ridgeW / 2, ridgeY);
  ctx.stroke();

  // Left gable end
  ctx.fillStyle = opts.rb;
  ctx.beginPath();
  ctx.moveTo(cx - eavesW / 2, eavesY);
  ctx.lineTo(cx - ridgeW / 2, ridgeY);
  ctx.lineTo(cx - backW / 2,  topY);
  ctx.lineTo(cx - eavesW / 2, topY);
  ctx.closePath();
  ctx.fill();

  // Right gable end
  ctx.beginPath();
  ctx.moveTo(cx + eavesW / 2, eavesY);
  ctx.lineTo(cx + ridgeW / 2, ridgeY);
  ctx.lineTo(cx + backW / 2,  topY);
  ctx.lineTo(cx + eavesW / 2, topY);
  ctx.closePath();
  ctx.fill();

  // Front wall
  ctx.fillStyle = opts.wc;
  ctx.fillRect(cx - eavesW / 2, eavesY, eavesW, wallBotY - eavesY);

  // Eaves shadow
  const es = ctx.createLinearGradient(0, eavesY, 0, eavesY + 7);
  es.addColorStop(0, 'rgba(0,0,0,0.3)');
  es.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = es;
  ctx.fillRect(cx - eavesW / 2, eavesY, eavesW, 7);

  // Wall base shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(cx - eavesW / 2, wallBotY - 3, eavesW, 3);

  if (opts.detail) opts.detail(ctx, cx, eavesY, wallBotY, eavesW);

  return { cx, topY, ridgeY, eavesY, wallBotY, eavesW, ridgeW, backW };
}

function chimneyPx(
  ctx: CanvasRenderingContext2D, s: number,
  x: number, topY: number, ridgeY: number,
  withSmoke = true,
) {
  const w = s * 0.055;
  const h = s * 0.12;
  ctx.fillStyle = '#8a7868';
  ctx.fillRect(x - w / 2, topY - h, w, h + ridgeY - topY + 2);
  ctx.fillStyle = '#6a5848';
  ctx.fillRect(x - w / 2 - 1, topY - h, w + 2, 3);
  if (withSmoke) {
    ctx.fillStyle = 'rgba(210,210,210,0.6)';
    ctx.beginPath(); ctx.arc(x, topY - h - 4, 3.5, 0, π * 2); ctx.fill();
    ctx.fillStyle = 'rgba(210,210,210,0.38)';
    ctx.beginPath(); ctx.arc(x - 2, topY - h - 10, 5, 0, π * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 3, topY - h - 16, 4, 0, π * 2); ctx.fill();
  }
}

// ─── Building drawers ─────────────────────────────────────────────────────────

function drawField(ctx: CanvasRenderingContext2D, s: number) {
  const m = s * 0.1;
  const fw = s - m * 2;
  const fh = s - m * 2;
  const rows = 7;
  const rowH = fh / rows;

  ctx.fillStyle = '#7a5028';
  ctx.fillRect(m, m, fw, fh);

  for (let i = 0; i < rows; i++) {
    const y = m + i * rowH;
    ctx.fillStyle = i % 2 === 0 ? '#8a6038' : '#6a4020';
    ctx.fillRect(m, y, fw, rowH);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(80,150,40,0.7)' : 'rgba(60,120,25,0.5)';
    ctx.fillRect(m + 2, y + rowH * 0.35, fw - 4, rowH * 0.3);
  }

  ctx.strokeStyle = '#5a3810';
  ctx.lineWidth = 2;
  ctx.strokeRect(m, m, fw, fh);

  dropShadow(ctx, s / 2, m + fh + 2, fw * 0.46, s * 0.04);
}

function drawPasture(ctx: CanvasRenderingContext2D, s: number) {
  const m  = s * 0.08;
  const fw = s * 0.84;
  const fh = s * 0.76;
  const ox = m;
  const oy = m;

  ctx.fillStyle = '#5a9a30';
  ctx.fillRect(ox, oy, fw, fh);

  // Grass texture patches
  ctx.fillStyle = 'rgba(80,160,40,0.3)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(ox + 12 + i * 17, oy + 16 + (i % 3) * 20, 8, 5, 0, 0, π * 2);
    ctx.fill();
  }

  const postW = 4, postH = 9;
  const railColor = '#a07038', postColor = '#8a5a28';

  ctx.strokeStyle = railColor;
  ctx.lineWidth = 2;
  // Top rails
  ctx.beginPath(); ctx.moveTo(ox, oy + postH * 0.5); ctx.lineTo(ox + fw, oy + postH * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox, oy + postH); ctx.lineTo(ox + fw, oy + postH); ctx.stroke();
  // Bottom rails
  ctx.beginPath(); ctx.moveTo(ox, oy + fh - postH * 0.5); ctx.lineTo(ox + fw, oy + fh - postH * 0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox, oy + fh - postH); ctx.lineTo(ox + fw, oy + fh - postH); ctx.stroke();
  // Left rails
  ctx.beginPath(); ctx.moveTo(ox + postH * 0.5, oy); ctx.lineTo(ox + postH * 0.5, oy + fh); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox + postH, oy); ctx.lineTo(ox + postH, oy + fh); ctx.stroke();
  // Right rails
  ctx.beginPath(); ctx.moveTo(ox + fw - postH * 0.5, oy); ctx.lineTo(ox + fw - postH * 0.5, oy + fh); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox + fw - postH, oy); ctx.lineTo(ox + fw - postH, oy + fh); ctx.stroke();

  ctx.fillStyle = postColor;
  const posts: [number, number][] = [
    [ox, oy], [ox + fw * 0.33, oy], [ox + fw * 0.66, oy], [ox + fw - postW, oy],
    [ox, oy + fh - postH], [ox + fw * 0.33, oy + fh - postH],
    [ox + fw * 0.66, oy + fh - postH], [ox + fw - postW, oy + fh - postH],
    [ox, oy + fh * 0.5 - postH / 2], [ox + fw - postW, oy + fh * 0.5 - postH / 2],
  ];
  for (const [px, py] of posts) ctx.fillRect(px, py, postW, postH);

  // Sheep
  ctx.fillStyle = '#e8e4d8';
  ctx.beginPath(); ctx.ellipse(ox + fw * 0.5, oy + fh * 0.5, 10, 7, 0, 0, π * 2); ctx.fill();
  ctx.fillStyle = '#3a2a18';
  ctx.beginPath(); ctx.ellipse(ox + fw * 0.5 + 9, oy + fh * 0.5 - 2, 5, 4, 0, 0, π * 2); ctx.fill();
}

function drawOrchard(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2;
  const cols = 3, rows = 2;
  const spX = s * 0.25, spY = s * 0.3;
  const startX = cx - spX;
  const startY = s * 0.22;
  const tR = s * 0.085;
  const fruitColors = ['#d84020', '#e8c020', '#d06030', '#50a020', '#d08020', '#a02090'];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tx = startX + c * spX;
      const ty = startY + r * spY;

      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(tx + 2, ty + 3, tR + 2, tR * 0.6, 0, 0, π * 2); ctx.fill();

      ctx.fillStyle = '#6a4020';
      ctx.fillRect(tx - 2, ty, 4, tR * 0.8);

      ctx.fillStyle = '#2d7020';
      ctx.beginPath(); ctx.arc(tx, ty - tR * 0.5, tR, 0, π * 2); ctx.fill();
      ctx.fillStyle = '#3a9028';
      ctx.beginPath(); ctx.arc(tx - tR * 0.3, ty - tR * 0.7, tR * 0.65, 0, π * 2); ctx.fill();

      ctx.fillStyle = fruitColors[(r * cols + c) % fruitColors.length];
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(tx + (i - 1) * tR * 0.5, ty - tR * 0.3 + (i % 2) * tR * 0.4, 3, 0, π * 2);
        ctx.fill();
      }
    }
  }
  dropShadow(ctx, cx, s * 0.82, s * 0.35, s * 0.04);
}

function drawFishery(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2;

  // Water
  ctx.fillStyle = '#2060a0';
  ctx.fillRect(cx - s * 0.2, s * 0.42, s * 0.5, s * 0.48);

  // Water highlights
  ctx.strokeStyle = 'rgba(140,200,255,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const wy = s * 0.52 + i * s * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.15 + i * s * 0.04, wy);
    ctx.quadraticCurveTo(cx + i * s * 0.03, wy - 3, cx + s * 0.1 + i * s * 0.03, wy);
    ctx.stroke();
  }

  // Dock planks (vertical)
  ctx.fillStyle = '#b08840';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx - s * 0.04 + i * s * 0.075, s * 0.44, s * 0.065, s * 0.44);
    ctx.fillStyle = '#8a6830';
    ctx.fillRect(cx - s * 0.04 + i * s * 0.075, s * 0.44, 1.5, s * 0.44);
    ctx.fillStyle = '#b08840';
  }

  // Cross planks
  ctx.strokeStyle = '#8a6830';
  ctx.lineWidth = 1.5;
  for (let j = 0; j < 5; j++) {
    const py = s * 0.44 + j * s * 0.09;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.04, py);
    ctx.lineTo(cx + s * 0.245, py);
    ctx.stroke();
  }

  // Fishing net
  ctx.strokeStyle = 'rgba(200,200,160,0.5)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.05, s * 0.5 + i * s * 0.07);
    ctx.lineTo(cx + s * 0.22, s * 0.5 + i * s * 0.07);
    ctx.stroke();
  }
  for (let j = 0; j < 5; j++) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.05 + j * s * 0.045, s * 0.5);
    ctx.lineTo(cx + s * 0.05 + j * s * 0.045, s * 0.78);
    ctx.stroke();
  }

  // Small hut
  const hcx    = cx - s * 0.22;
  const htopY  = s * 0.22;
  const hridgeY = s * 0.34;
  const heavesY = s * 0.47;
  const hwallBot = s * 0.57;
  const hbw    = s * 0.28;

  dropShadow(ctx, hcx, hwallBot, hbw * 0.46, s * 0.035);

  ctx.fillStyle = '#8a5828';
  ctx.beginPath();
  ctx.moveTo(hcx - hbw * 0.38, htopY); ctx.lineTo(hcx + hbw * 0.38, htopY);
  ctx.lineTo(hcx + hbw * 0.32, hridgeY); ctx.lineTo(hcx - hbw * 0.32, hridgeY);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#b07038';
  ctx.beginPath();
  ctx.moveTo(hcx - hbw * 0.32, hridgeY); ctx.lineTo(hcx + hbw * 0.32, hridgeY);
  ctx.lineTo(hcx + hbw / 2, heavesY); ctx.lineTo(hcx - hbw / 2, heavesY);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#c0a070';
  ctx.fillRect(hcx - hbw / 2, heavesY, hbw, hwallBot - heavesY);

  doorPx(ctx, hcx, heavesY + 2, 8, 10, '#4a2808', '#6a3818');
}

function drawSmokehouse(ctx: CanvasRenderingContext2D, s: number) {
  const l = drawGabled(ctx, s, {
    rf: '#8a4820',
    rb: '#5a2a10',
    rr: '#c07040',
    wc: '#6a4020',
    bwf: 0.50,
    whf: 0.14,
    detail: (ctx2, cx, eavesY, wallBotY, eavesW) => {
      ctx2.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx2.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const py = eavesY + (wallBotY - eavesY) * (i / 3);
        ctx2.beginPath();
        ctx2.moveTo(cx - eavesW / 2, py); ctx2.lineTo(cx + eavesW / 2, py);
        ctx2.stroke();
      }
      doorPx(ctx2, cx, eavesY + 3, 12, wallBotY - eavesY - 4, '#3a1808', '#5a2810');
    },
  });
  chimneyPx(ctx, s, l.cx + l.ridgeW * 0.25, l.topY, l.ridgeY, true);
}

function drawKitchen(ctx: CanvasRenderingContext2D, s: number) {
  const l = drawGabled(ctx, s, {
    rf: '#c06038',
    rb: '#8a3820',
    rr: '#e09060',
    wc: '#b0a090',
    bwf: 0.61,
    whf: 0.15,
    detail: (ctx2, cx, eavesY, wallBotY, eavesW) => {
      ctx2.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx2.lineWidth = 0.8;
      for (let i = 1; i <= 3; i++) {
        ctx2.beginPath();
        ctx2.moveTo(cx - eavesW / 2, eavesY + (wallBotY - eavesY) * i / 4);
        ctx2.lineTo(cx + eavesW / 2, eavesY + (wallBotY - eavesY) * i / 4);
        ctx2.stroke();
      }
      doorPx(ctx2, cx, eavesY + 3, 12, wallBotY - eavesY - 4);
      windowPx(ctx2, cx - eavesW / 2 + 8, eavesY + 5, 10, 8);
      windowPx(ctx2, cx + eavesW / 2 - 18, eavesY + 5, 10, 8);
    },
  });
  chimneyPx(ctx, s, l.cx - l.ridgeW * 0.2, l.topY, l.ridgeY, true);
  chimneyPx(ctx, s, l.cx + l.ridgeW * 0.2, l.topY, l.ridgeY, true);
}

function drawMill(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2;
  const cy = s * 0.5;
  const r  = s * 0.14;

  dropShadow(ctx, cx, cy + r, r * 1.3, r * 0.4);

  // Sail arms (behind tower)
  const armLen = s * 0.37;
  const armW   = s * 0.055;
  const sailAngles = [π * 0.25, π * 0.75, π * 1.25, π * 1.75];
  for (const angle of sailAngles) {
    ctx.save();
    ctx.translate(cx, cy - r * 0.1);
    ctx.rotate(angle);
    ctx.fillStyle = '#8a6030';
    ctx.fillRect(-armW / 2, 0, armW, armLen);
    ctx.fillStyle = '#e8d8b0';
    ctx.fillRect(-armW / 2 + 2, s * 0.02, armW - 4, armLen - s * 0.08);
    ctx.restore();
  }

  // Tower shadow / base
  ctx.fillStyle = '#a09080';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.2, r, r * 0.55, 0, 0, π * 2); ctx.fill();

  // Tower body
  const towerGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy - r);
  towerGrad.addColorStop(0,   '#8a7860');
  towerGrad.addColorStop(0.4, '#b0a090');
  towerGrad.addColorStop(1,   '#706050');
  ctx.fillStyle = towerGrad;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.82, cy - r * 1.5);
  ctx.lineTo(cx + r * 0.82, cy - r * 1.5);
  ctx.lineTo(cx + r, cy + r * 0.15);
  ctx.lineTo(cx - r, cy + r * 0.15);
  ctx.closePath(); ctx.fill();

  // Stone ring lines
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const ly = cy - r * 1.5 + i * r * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.82, ly); ctx.lineTo(cx + r * 0.82, ly);
    ctx.stroke();
  }

  // Tower cap (cone)
  ctx.fillStyle = '#8a4820';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 2.1);
  ctx.lineTo(cx - r * 0.88, cy - r * 1.5);
  ctx.lineTo(cx + r * 0.88, cy - r * 1.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b06030';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 2.1);
  ctx.lineTo(cx - r * 0.5, cy - r * 1.72);
  ctx.lineTo(cx + r * 0.5, cy - r * 1.72);
  ctx.closePath(); ctx.fill();

  // Door
  ctx.fillStyle = '#4a2808';
  ctx.fillRect(cx - 5, cy - 2, 10, 15);
  ctx.fillStyle = '#7a4818';
  ctx.fillRect(cx - 4, cy - 1, 8, 13);
}

function drawMine(ctx: CanvasRenderingContext2D, s: number) {
  const cx     = s / 2;
  const mouthY = s * 0.55;
  const mouthW = s * 0.32;
  const mouthH = s * 0.24;

  // Rock mound
  ctx.fillStyle = '#7a6848';
  ctx.beginPath();
  ctx.ellipse(cx, mouthY - mouthH * 0.1, s * 0.4, s * 0.22, 0, 0, π * 2);
  ctx.fill();

  // Rock rubble
  ctx.fillStyle = '#8a7860';
  const rubble: [number, number, number, number][] = [
    [cx - s * 0.34, mouthY + s * 0.04, 8, 5],
    [cx - s * 0.28, mouthY + s * 0.08, 6, 4],
    [cx + s * 0.28, mouthY + s * 0.02, 9, 5],
    [cx + s * 0.34, mouthY + s * 0.07, 7, 4],
  ];
  for (const [rx, ry, rw, rh] of rubble) {
    ctx.beginPath(); ctx.ellipse(rx, ry, rw, rh, 0, 0, π * 2); ctx.fill();
  }

  // Wooden A-frame
  ctx.strokeStyle = '#6a4020';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx - mouthW * 0.38, mouthY - mouthH); ctx.lineTo(cx - mouthW * 0.5, mouthY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + mouthW * 0.38, mouthY - mouthH); ctx.lineTo(cx + mouthW * 0.5, mouthY); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - mouthW * 0.45, mouthY - mouthH * 0.55); ctx.lineTo(cx + mouthW * 0.45, mouthY - mouthH * 0.55); ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx - mouthW * 0.35, mouthY - mouthH); ctx.lineTo(cx + mouthW * 0.35, mouthY - mouthH); ctx.stroke();

  // Shaft entrance
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(cx - mouthW / 2, mouthY - mouthH * 0.85, mouthW, mouthH * 0.85);
  ctx.beginPath();
  ctx.arc(cx, mouthY - mouthH * 0.85, mouthW / 2, π, 0);
  ctx.lineTo(cx + mouthW / 2, mouthY - mouthH * 0.85);
  ctx.closePath(); ctx.fill();

  // Cart tracks
  ctx.strokeStyle = '#8a6830';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 8, mouthY); ctx.lineTo(cx - 10, mouthY + s * 0.28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 8, mouthY); ctx.lineTo(cx + 10, mouthY + s * 0.28); ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const ty = mouthY + i * s * 0.07;
    ctx.beginPath(); ctx.moveTo(cx - 8 - i, ty); ctx.lineTo(cx + 8 + i, ty); ctx.stroke();
  }

  // Ore pile
  ctx.fillStyle = '#6a5848';
  ctx.beginPath(); ctx.ellipse(cx + s * 0.3, mouthY + s * 0.05, 12, 8, 0, 0, π * 2); ctx.fill();
  ctx.fillStyle = '#8a8070';
  ctx.beginPath(); ctx.ellipse(cx + s * 0.3, mouthY + s * 0.03, 9, 6, 0, 0, π * 2); ctx.fill();
  ctx.fillStyle = 'rgba(180,160,60,0.5)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(cx + s * 0.28 + i * 5, mouthY + s * 0.02 + i * 2, 1.5, 0, π * 2); ctx.fill();
  }

  dropShadow(ctx, cx, mouthY + s * 0.08, s * 0.3, s * 0.04);
}

function drawSawmill(ctx: CanvasRenderingContext2D, s: number) {
  const l = drawGabled(ctx, s, {
    rf: '#b06838',
    rb: '#7a4020',
    rr: '#d09060',
    wc: '#c0a878',
    bwf: 0.50,
    whf: 0.13,
    detail: (ctx2, cx, eavesY, wallBotY, eavesW) => {
      doorPx(ctx2, cx + eavesW * 0.1, eavesY + 3, 14, wallBotY - eavesY - 4);
      // Saw wheel
      const wx = cx - eavesW * 0.28;
      const wy = eavesY + (wallBotY - eavesY) * 0.5;
      ctx2.fillStyle = '#5a3810';
      ctx2.beginPath(); ctx2.arc(wx, wy, 8, 0, π * 2); ctx2.fill();
      ctx2.fillStyle = '#7a5020';
      ctx2.beginPath(); ctx2.arc(wx, wy, 6, 0, π * 2); ctx2.fill();
      ctx2.strokeStyle = '#c0c0b0';
      ctx2.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * π * 2;
        ctx2.beginPath();
        ctx2.moveTo(wx + Math.cos(ang) * 6, wy + Math.sin(ang) * 6);
        ctx2.lineTo(wx + Math.cos(ang) * 9, wy + Math.sin(ang) * 9);
        ctx2.stroke();
      }
    },
  });

  // Log pile (right side)
  const logX = l.cx + l.eavesW * 0.52;
  for (let i = 0; i < 4; i++) {
    const ly = l.eavesY + (l.wallBotY - l.eavesY) * 0.3 + i * 5 - 2;
    const stagger = i % 2 === 0 ? 0 : 3;
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = '#8a5828';
      ctx.beginPath(); ctx.ellipse(logX + stagger + j * 9, ly, 5, 4, 0, 0, π * 2); ctx.fill();
      ctx.fillStyle = '#c09060';
      ctx.beginPath(); ctx.arc(logX + stagger + j * 9, ly, 3, 0, π * 2); ctx.fill();
    }
  }

  // Lumber plank stack (left side)
  const plankX = l.cx - l.eavesW * 0.6;
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#c09860';
    ctx.fillRect(plankX - 8, l.eavesY + i * 5, 22, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(plankX - 8, l.eavesY + i * 5, 22, 1);
  }
}

function drawPort(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2;

  // Water
  ctx.fillStyle = '#1a5898';
  ctx.fillRect(0, s * 0.48, s, s * 0.52);
  ctx.strokeStyle = 'rgba(80,160,220,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const wy = s * 0.54 + i * s * 0.07;
    ctx.beginPath();
    ctx.moveTo(s * 0.05, wy);
    ctx.quadraticCurveTo(cx, wy - 3, s * 0.95, wy);
    ctx.stroke();
  }

  // Stone quay
  ctx.fillStyle = '#9a9080';
  ctx.fillRect(cx - s * 0.38, s * 0.44, s * 0.76, s * 0.12);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.38 + (s * 0.76 / 4) * i, s * 0.44);
    ctx.lineTo(cx - s * 0.38 + (s * 0.76 / 4) * i, s * 0.56);
    ctx.stroke();
  }

  // Dock extension
  ctx.fillStyle = '#b09878';
  ctx.fillRect(cx - s * 0.06, s * 0.56, s * 0.12, s * 0.28);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.06, s * 0.56 + i * s * 0.057);
    ctx.lineTo(cx + s * 0.06, s * 0.56 + i * s * 0.057);
    ctx.stroke();
  }

  // Bollards
  const bollards = [cx - s * 0.3, cx - s * 0.1, cx + s * 0.1, cx + s * 0.3];
  for (const bx of bollards) {
    ctx.fillStyle = '#6a5840';
    ctx.beginPath(); ctx.arc(bx, s * 0.52, 3.5, 0, π * 2); ctx.fill();
    ctx.fillStyle = '#8a7858';
    ctx.beginPath(); ctx.arc(bx - 0.5, s * 0.52 - 1, 2, 0, π * 2); ctx.fill();
  }

  // Rope coil
  ctx.strokeStyle = '#c0a878';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx - s * 0.22, s * 0.50, 4, 0, π * 1.8); ctx.stroke();

  // Ship mast
  const mastX = cx + s * 0.2;
  ctx.fillStyle = '#5a3810';
  ctx.fillRect(mastX - 2, s * 0.16, 4, s * 0.38);
  ctx.fillRect(mastX - s * 0.1, s * 0.22, s * 0.2, 2);
  ctx.fillStyle = '#d8c8a0';
  ctx.fillRect(mastX - s * 0.08, s * 0.24, s * 0.16, s * 0.06);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(mastX - s * 0.08, s * 0.24, s * 0.16, 2);

  // Dock hut
  const hcx     = cx - s * 0.22;
  const htopY   = s * 0.18;
  const hridgeY = s * 0.28;
  const heavesY = s * 0.40;
  const hwallBot = s * 0.48;
  const hbw     = s * 0.28;

  dropShadow(ctx, hcx, hwallBot, hbw * 0.5, s * 0.03);
  ctx.fillStyle = '#8a5828';
  ctx.beginPath();
  ctx.moveTo(hcx - hbw * 0.36, htopY); ctx.lineTo(hcx + hbw * 0.36, htopY);
  ctx.lineTo(hcx + hbw * 0.30, hridgeY); ctx.lineTo(hcx - hbw * 0.30, hridgeY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b07838';
  ctx.beginPath();
  ctx.moveTo(hcx - hbw * 0.30, hridgeY); ctx.lineTo(hcx + hbw * 0.30, hridgeY);
  ctx.lineTo(hcx + hbw / 2, heavesY); ctx.lineTo(hcx - hbw / 2, heavesY);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b09878';
  ctx.fillRect(hcx - hbw / 2, heavesY, hbw, hwallBot - heavesY);
  doorPx(ctx, hcx, heavesY + 2, 8, 10, '#4a2808', '#6a3818');
}

function drawBarracks(ctx: CanvasRenderingContext2D, s: number) {
  const l = drawGabled(ctx, s, {
    rf: '#6a1820',
    rb: '#4a1010',
    rr: '#9a4040',
    wc: '#8a8078',
    bwf: 0.70,
    whf: 0.15,
    detail: (ctx2, cx, eavesY, wallBotY, eavesW) => {
      ctx2.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx2.lineWidth = 1;
      for (let i = 0; i <= 2; i++) {
        ctx2.beginPath();
        ctx2.moveTo(cx - eavesW / 2, eavesY + (wallBotY - eavesY) * i / 3);
        ctx2.lineTo(cx + eavesW / 2, eavesY + (wallBotY - eavesY) * i / 3);
        ctx2.stroke();
      }
      doorPx(ctx2, cx - eavesW * 0.15, eavesY + 3, 12, wallBotY - eavesY - 4, '#3a1808', '#5a2810');
      windowPx(ctx2, cx + eavesW * 0.12, eavesY + 5, 10, 8);
    },
  });

  // Battlements
  const merW = 6, merH = 7;
  ctx.fillStyle = '#9a9080';
  let bx = l.cx - l.eavesW / 2;
  while (bx < l.cx + l.eavesW / 2 - merW) {
    ctx.fillRect(bx, l.eavesY - merH, merW, merH);
    bx += merW + 8;
  }

  // Flag
  ctx.fillStyle = '#5a1010';
  ctx.fillRect(l.cx + l.eavesW * 0.3 - 1, l.topY - s * 0.11, 2, s * 0.17);
  ctx.fillStyle = '#c82020';
  ctx.fillRect(l.cx + l.eavesW * 0.3 + 1, l.topY - s * 0.11, 12, 8);
  ctx.fillStyle = '#f04040';
  ctx.fillRect(l.cx + l.eavesW * 0.3 + 1, l.topY - s * 0.11, 12, 4);

  // Spear rack
  ctx.strokeStyle = '#8a6838';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const sx = l.cx - l.eavesW * 0.45 + i * 9;
    ctx.beginPath(); ctx.moveTo(sx, l.wallBotY); ctx.lineTo(sx - 2, l.eavesY + 5); ctx.stroke();
    ctx.fillStyle = '#b0b0a0';
    ctx.beginPath();
    ctx.moveTo(sx - 4, l.eavesY + 4);
    ctx.lineTo(sx, l.eavesY);
    ctx.lineTo(sx + 1, l.eavesY + 4);
    ctx.closePath(); ctx.fill();
  }
}

function drawMarket(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2;
  const stallW = s * 0.26;
  const stallH = s * 0.36;
  const stallY = s * 0.32;
  const awningH = s * 0.12;
  const rfColors = ['#c03020', '#d4a030', '#2050a0'];
  const rbColors = ['#802010', '#9a7018', '#163878'];
  const stallX   = [cx - stallW - 2, cx, cx + stallW + 2];

  for (let i = 0; i < 3; i++) {
    const sx   = stallX[i];
    const halfW = stallW / 2;

    // Awning back
    ctx.fillStyle = rbColors[i];
    ctx.beginPath();
    ctx.moveTo(sx - halfW - 4, stallY); ctx.lineTo(sx + halfW + 4, stallY);
    ctx.lineTo(sx + halfW, stallY + awningH); ctx.lineTo(sx - halfW, stallY + awningH);
    ctx.closePath(); ctx.fill();

    // Awning front
    ctx.fillStyle = rfColors[i];
    ctx.beginPath();
    ctx.moveTo(sx - halfW - 3, stallY); ctx.lineTo(sx + halfW + 3, stallY);
    ctx.lineTo(sx + halfW, stallY + awningH); ctx.lineTo(sx - halfW, stallY + awningH);
    ctx.closePath(); ctx.fill();

    // Awning stripes
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let j = 0; j < 3; j++) {
      ctx.fillRect(sx - halfW + j * stallW * 0.28, stallY, stallW * 0.1, awningH);
    }

    // Stall body
    ctx.fillStyle = '#c0a870';
    ctx.fillRect(sx - halfW, stallY + awningH, stallW, stallH - awningH);

    // Counter
    ctx.fillStyle = '#8a6838';
    ctx.fillRect(sx - halfW - 2, stallY + awningH + s * 0.1, stallW + 4, 5);

    // Goods
    const goodColors = [
      ['#d04020', '#e8c030', '#50a830'],
      ['#c85020', '#d0c020', '#3090c0'],
      ['#20a060', '#d89030', '#c82828'],
    ];
    for (let g = 0; g < 3; g++) {
      ctx.fillStyle = goodColors[i][g];
      ctx.fillRect(sx - halfW + 4 + g * (stallW * 0.25), stallY + awningH + 2, 8, 8);
    }

    // Support posts
    ctx.fillStyle = '#6a4820';
    ctx.fillRect(sx - halfW, stallY, 4, stallH);
    ctx.fillRect(sx + halfW - 4, stallY, 4, stallH);
  }

  dropShadow(ctx, cx, stallY + stallH + 4, s * 0.45, s * 0.04);
}

function drawChurch(ctx: CanvasRenderingContext2D, s: number) {
  const l = drawGabled(ctx, s, {
    rf: '#888078',
    rb: '#585048',
    rr: '#b0a898',
    wc: '#a09888',
    bwf: 0.58,
    whf: 0.18,
    detail: (ctx2, cx, eavesY, wallBotY, eavesW) => {
      // Masonry lines
      ctx2.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx2.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx2.beginPath();
        ctx2.moveTo(cx - eavesW / 2, eavesY + (wallBotY - eavesY) * i / 4);
        ctx2.lineTo(cx + eavesW / 2, eavesY + (wallBotY - eavesY) * i / 4);
        ctx2.stroke();
      }
      // Gothic door
      const dw = 14, dx = cx - dw / 2, dy = eavesY + 2, dh = wallBotY - eavesY - 3;
      ctx2.fillStyle = '#3a3028';
      ctx2.fillRect(dx, dy, dw, dh);
      ctx2.beginPath(); ctx2.arc(cx, dy + 2, dw / 2, π, 0); ctx2.fill();
      ctx2.fillStyle = '#8ab8d8';
      ctx2.fillRect(dx + 1.5, dy + 1, dw - 3, dh - 1);
      ctx2.beginPath(); ctx2.arc(cx, dy + 2, dw / 2 - 1.5, π, 0); ctx2.fill();
      // Gothic windows
      for (const wx of [cx - eavesW * 0.38, cx + eavesW * 0.24]) {
        ctx2.fillStyle = '#3a3028';
        ctx2.fillRect(wx, eavesY + 3, 8, 12);
        ctx2.beginPath(); ctx2.arc(wx + 4, eavesY + 5, 4, π, 0); ctx2.fill();
        ctx2.fillStyle = '#8ab8d8';
        ctx2.fillRect(wx + 1, eavesY + 4, 6, 10);
        ctx2.beginPath(); ctx2.arc(wx + 4, eavesY + 5, 3, π, 0); ctx2.fill();
        ctx2.fillStyle = 'rgba(255,255,255,0.35)';
        ctx2.fillRect(wx + 1, eavesY + 4, 3, 5);
      }
    },
  });

  // Spire
  const spireX    = l.cx;
  const spireBase = l.ridgeY;
  const spireTop  = s * 0.06;
  const spireW    = s * 0.07;

  ctx.fillStyle = '#686058';
  ctx.beginPath();
  ctx.moveTo(spireX, spireTop);
  ctx.lineTo(spireX - spireW / 2, spireBase);
  ctx.lineTo(spireX + spireW / 2, spireBase);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#908878';
  ctx.beginPath();
  ctx.moveTo(spireX, spireTop);
  ctx.lineTo(spireX - spireW * 0.18, spireBase);
  ctx.lineTo(spireX, spireBase - (spireBase - spireTop) * 0.3);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#888078';
  ctx.fillRect(spireX - spireW * 0.65, spireBase - 2, spireW * 1.3, 6);

  // Cross
  ctx.fillStyle = '#c0b8a0';
  ctx.fillRect(spireX - 1, spireTop + 2, 2, 10);
  ctx.fillRect(spireX - 5, spireTop + 5, 10, 2);
}

function drawCastle(ctx: CanvasRenderingContext2D, s: number) {
  const cx    = s / 2;
  const cy    = s * 0.5;
  const keepW = s * 0.58;
  const keepH = s * 0.52;
  const keepX = cx - keepW / 2;
  const keepY = cy - keepH * 0.68;

  dropShadow(ctx, cx, keepY + keepH, keepW * 0.5, s * 0.06);

  // Keep body
  ctx.fillStyle = '#9a9080';
  ctx.fillRect(keepX, keepY, keepW, keepH);

  // Masonry grid
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath(); ctx.moveTo(keepX, keepY + keepH * i / 6); ctx.lineTo(keepX + keepW, keepY + keepH * i / 6); ctx.stroke();
  }
  for (let j = 1; j <= 3; j++) {
    ctx.beginPath(); ctx.moveTo(keepX + keepW * j / 4, keepY); ctx.lineTo(keepX + keepW * j / 4, keepY + keepH); ctx.stroke();
  }

  // Corner towers
  const tR = s * 0.085;
  const towers: [number, number][] = [
    [keepX, keepY], [keepX + keepW, keepY],
    [keepX, keepY + keepH], [keepX + keepW, keepY + keepH],
  ];
  for (const [tx, ty] of towers) {
    ctx.fillStyle = '#b0a898';
    ctx.beginPath(); ctx.arc(tx, ty, tR, 0, π * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tx, ty, tR, 0, π * 2); ctx.stroke();
    ctx.fillStyle = '#606058';
    ctx.beginPath();
    ctx.moveTo(tx, ty - tR - s * 0.04);
    ctx.arc(tx, ty, tR * 0.9, π * 1.1, π * 1.9, false);
    ctx.closePath(); ctx.fill();
  }

  // Battlements
  const merW = 7, merH = 9;
  ctx.fillStyle = '#a09888';
  let bx = keepX;
  while (bx < keepX + keepW - merW) {
    ctx.fillRect(bx, keepY - merH, merW, merH);
    bx += merW + 9;
  }

  // Portcullis gate
  const gateW = s * 0.14;
  const gateH = s * 0.18;
  const gateX = cx - gateW / 2;
  const gateY = keepY + keepH - gateH;
  ctx.fillStyle = '#1a1610';
  ctx.fillRect(gateX, gateY, gateW, gateH);
  ctx.beginPath(); ctx.arc(cx, gateY, gateW / 2, π, 0); ctx.fill();
  ctx.strokeStyle = '#5a5040';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(gateX + gateW * (i + 1) / 4, gateY); ctx.lineTo(gateX + gateW * (i + 1) / 4, gateY + gateH); ctx.stroke();
  }
  for (let j = 0; j < 3; j++) {
    ctx.beginPath(); ctx.moveTo(gateX, gateY + gateH * (j + 1) / 4); ctx.lineTo(gateX + gateW, gateY + gateH * (j + 1) / 4); ctx.stroke();
  }

  // Roof fill + flag
  ctx.fillStyle = '#808070';
  ctx.fillRect(keepX, keepY - 4, keepW, 6);

  ctx.fillStyle = '#5a1010';
  ctx.fillRect(cx - 1, keepY - s * 0.14, 2, s * 0.14);
  ctx.fillStyle = '#d82020';
  ctx.fillRect(cx + 1, keepY - s * 0.14, 14, 9);
  ctx.fillStyle = '#f04040';
  ctx.fillRect(cx + 1, keepY - s * 0.14, 14, 4);
}

// ─── Registry & export ────────────────────────────────────────────────────────

const BUILDING_DRAWERS: Record<BuildingType, DrawFn> = {
  field:      drawField,
  pasture:    drawPasture,
  orchard:    drawOrchard,
  fishery:    drawFishery,
  smokehouse: drawSmokehouse,
  kitchen:    drawKitchen,
  mill:       drawMill,
  mine:       drawMine,
  sawmill:    drawSawmill,
  port:       drawPort,
  barracks:   drawBarracks,
  market:     drawMarket,
  church:     drawChurch,
  castle:     drawCastle,
};

export function generateBuildingTextures(tileSize: number): Map<string, HTMLCanvasElement> {
  const result = new Map<string, HTMLCanvasElement>();
  for (const [type, drawFn] of Object.entries(BUILDING_DRAWERS) as [BuildingType, DrawFn][]) {
    const canvas = document.createElement('canvas');
    canvas.width  = tileSize;
    canvas.height = tileSize;
    drawFn(canvas.getContext('2d')!, tileSize);
    result.set(`building-${type}`, canvas);
  }
  return result;
}
