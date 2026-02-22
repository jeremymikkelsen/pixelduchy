import Phaser from 'phaser';
import { generateWorld } from '../procgen/worldgen';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { TILE_SIZE, NUM_TILE_VARIANTS, getSeasonIndex } from '../procgen/tileRenderer';
import type { WorldMap, Tile, Duchy, TileType } from '../../types';

/**
 * MapScene - renders the game world tilemap and handles camera/input.
 */
export class MapScene extends Phaser.Scene {
  private world!: WorldMap;
  private tileGroup!: Phaser.GameObjects.Group;
  private biomeTransitionLayer!: Phaser.GameObjects.Graphics;
  private territoryOverlay!: Phaser.GameObjects.Graphics;
  private riverGraphics!: Phaser.GameObjects.Graphics;
  private buildingSprites: Phaser.GameObjects.Image[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragScreenStartX = 0;
  private dragScreenStartY = 0;
  private unsubscribeStore?: () => void;
  private currentSeasonIndex = 0;
  private vegetationLayer!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'MapScene' });
  }

  create() {
    const existingSession = useGameStore.getState().session;
    this.world = existingSession?.map ?? generateWorld({ width: 64, height: 64, seed: Date.now() });
    this.currentSeasonIndex = getSeasonIndex(existingSession?.turnNumber ?? 1);

    this.tileGroup = this.add.group();
    // Depth: tiles(0) → transitions(0.35) → rivers(0.5) → vegetation(0.55) → territory(1)
    this.biomeTransitionLayer = this.add.graphics().setDepth(0.35);
    this.riverGraphics = this.add.graphics().setDepth(0.5);
    this.vegetationLayer = this.add.graphics().setDepth(0.55);
    this.territoryOverlay = this.add.graphics().setDepth(1);

    this.renderMap();
    this.renderBiomeTransitions();
    this.renderRivers();
    this.renderVegetation();
    this.setupCamera();
    this.setupInput();

    this.scene.launch('UIScene');

    this.unsubscribeStore = useGameStore.subscribe((state) => {
      const newMap = state.session?.map;
      if (newMap && newMap !== this.world) {
        this.world = newMap;
        this.tileGroup.clear(true, true);
        this.renderMap();
        this.renderBiomeTransitions();
        this.renderRivers();
        this.renderVegetation();
        if (state.myDuchy?.tiles.length) {
          const ts = state.myDuchy.tiles;
          const cx = ts.reduce((s, t) => s + t.x, 0) / ts.length;
          const cy = ts.reduce((s, t) => s + t.y, 0) / ts.length;
          this.cameras.main.centerOn(cx * TILE_SIZE + TILE_SIZE / 2, cy * TILE_SIZE + TILE_SIZE / 2);
        }
      }

      // Update tile textures when the season changes (each turn cycles the season)
      const turnNumber = state.session?.turnNumber ?? 1;
      const newSeason = getSeasonIndex(turnNumber);
      if (newSeason !== this.currentSeasonIndex) {
        this.currentSeasonIndex = newSeason;
        this.updateSeasonTextures();
        this.renderBiomeTransitions();
        this.renderVegetation();
      }

      this.renderOverlays(state.allDuchies);
    });

    this.renderOverlays(useGameStore.getState().allDuchies);
  }

  shutdown() {
    this.unsubscribeStore?.();
    this.buildingSprites = [];
  }

  // ─── Tile rendering ──────────────────────────────────────────────────────────

  private tileKey(type: TileType, x: number, y: number): string {
    const variant = Math.abs(x * 7 + y * 13) % NUM_TILE_VARIANTS;
    return `${type}-s${this.currentSeasonIndex}-v${variant}`;
  }

  private renderMap() {
    const { tiles, width, height } = this.world;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile: Tile = tiles[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        const img = this.add
          .image(px, py, this.tileKey(tile.type, x, y))
          .setOrigin(0, 0)
          .setInteractive();

        // Store coords + type so updateSeasonTextures can find them
        img.setData('tx', x);
        img.setData('ty', y);
        img.setData('tt', tile.type);

        img.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (this.dragMoved) return;
          const ev = pointer.event as MouseEvent;
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          if (el?.closest('.panel, .hud-bar')) return;
          useUIStore.getState().setSelectedTile({ x, y });
        });

        this.tileGroup.add(img);
      }
    }
  }

  /** Swap every tile image to the current season's texture without rebuilding the scene. */
  private updateSeasonTextures() {
    for (const child of this.tileGroup.getChildren()) {
      const img = child as Phaser.GameObjects.Image;
      const tx = img.getData('tx') as number;
      const ty = img.getData('ty') as number;
      const tt = img.getData('tt') as TileType;
      img.setTexture(this.tileKey(tt, tx, ty));
    }
  }

  // ─── Biome transition decoration ─────────────────────────────────────────────

  /** Draws procedural decorations near biome boundaries — a sparse overlay layer
   *  placed between biome tiles (depth 0.35) and rivers (depth 0.5). */
  private renderBiomeTransitions() {
    this.biomeTransitionLayer.clear();
    const { tiles, width, height } = this.world;
    const season = this.currentSeasonIndex;
    const TS = TILE_SIZE;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y][x];
        if (tile.type === 'ocean') continue;

        const dirs = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        ] as const;

        for (const { dx, dy } of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = tiles[ny][nx];
          if (neighbor.type === tile.type) continue;

          // Unique, reproducible seed per directed edge (tile → neighbor direction)
          const rng = makeRng(((x * 7919 + y * 6271 + (dx + 2) * 3581 + (dy + 2) * 4127) * 2053) >>> 0);

          // Centre of the shared edge in pixel space
          const edgeCX = (x + 0.5 + dx * 0.5) * TS;
          const edgeCY = (y + 0.5 + dy * 0.5) * TS;

          const isForestEdge  = tile.type === 'forest'  || neighbor.type === 'forest';
          const isOceanEdge   = neighbor.type === 'ocean';
          const isWetlandEdge = tile.type === 'wetland' || neighbor.type === 'wetland';
          const count = isForestEdge  ? 4 + Math.floor(rng() * 3)
                      : isOceanEdge   ? 4 + Math.floor(rng() * 4)
                      : isWetlandEdge ? 3 + Math.floor(rng() * 3)
                      : 2 + Math.floor(rng() * 2);
          for (let i = 0; i < count; i++) {
            const along = (rng() - 0.5) * (TS - 10);
            const depth = isForestEdge  ? 14 + rng() * 36
                        : isOceanEdge   ? 8  + rng() * 40
                        : isWetlandEdge ? 8  + rng() * 28
                        : 6 + rng() * 14;
            // Normal into tile = (-dx, -dy); perpendicular along edge = (-dy, dx)
            const px = edgeCX + (-dy) * along - dx * depth;
            const py = edgeCY + ( dx) * along - dy * depth;

            this.drawTransitionDecoration(tile.type, neighbor.type, px, py, rng, season);
          }
        }
      }
    }
  }

  private drawTransitionDecoration(
    fromType: TileType, toType: TileType,
    px: number, py: number,
    rng: () => number, season: number,
  ): void {
    const g = this.biomeTransitionLayer;
    // Beach strip on any land tile bordering ocean
    if (toType === 'ocean') {
      transitionBeach(g, px, py, rng, season);
      return;
    }
    switch (fromType) {
      case 'forest':
        transitionTree(g, px, py, rng, season);
        break;
      case 'mountain':
        transitionRock(g, px, py, rng, season);
        break;
      case 'plains':
        if (toType === 'desert') transitionDryGrass(g, px, py, rng, season);
        else if (toType === 'wetland') transitionReed(g, px, py, rng, season);
        else transitionSparseGrass(g, px, py, rng, season);
        break;
      case 'desert':
        transitionPebble(g, px, py, rng, season);
        break;
      case 'wetland':
        transitionWaterEdge(g, px, py, rng, season);
        break;
      case 'coast':
        transitionPebble(g, px, py, rng, season);
        break;
      default:
        break;
    }
  }

  // ─── River rendering ─────────────────────────────────────────────────────────

  private renderRivers() {
    this.riverGraphics.clear();
    const rivers = this.world.rivers ?? [];
    const { tiles } = this.world;

    for (const river of rivers) {
      if (river.length < 2) continue;

      // Add sub-tile offsets so the river doesn't run through the exact centre of
      // every tile. The offset is seeded per tile position for reproducibility.
      const raw = river.map((p, i) => {
        const rng = makeRng((p.x * 7919 + p.y * 6271) >>> 0);
        // Grow the allowed wander gradually — near the source stay close to centre.
        const wander = Math.min(1, i / 4) * (TILE_SIZE * 0.28);
        return {
          x: p.x * TILE_SIZE + TILE_SIZE / 2 + (rng() - 0.5) * 2 * wander,
          y: p.y * TILE_SIZE + TILE_SIZE / 2 + (rng() - 0.5) * 2 * wander,
        };
      });

      const smooth = catmullRom(raw, 6);
      if (smooth.length < 2) continue;

      // Build a filled polygon: left edge (narrow at source) → right edge (wide at mouth).
      // Width grows from MIN_W at index 0 to MAX_W at the last smooth point.
      const MIN_W = 1.5;
      const MAX_W = 10.0;
      const n = smooth.length;
      const leftPts:  { x: number; y: number }[] = [];
      const rightPts: { x: number; y: number }[] = [];

      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        const halfW = (MIN_W + (MAX_W - MIN_W) * t) / 2;

        const prev = smooth[Math.max(0, i - 1)];
        const next = smooth[Math.min(n - 1, i + 1)];
        const tdx = next.x - prev.x;
        const tdy = next.y - prev.y;
        const len = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
        // Perpendicular (left-hand side)
        const px = -tdy / len;
        const py =  tdx / len;

        leftPts.push ({ x: smooth[i].x + px * halfW, y: smooth[i].y + py * halfW });
        rightPts.push({ x: smooth[i].x - px * halfW, y: smooth[i].y - py * halfW });
      }

      // Outer shadow / glow pass (slightly wider, low alpha)
      this.riverGraphics.fillStyle(0x2060b0, 0.18);
      const shadowPoly = buildWidenedPoly(smooth, MIN_W + 3, MAX_W + 6);
      this.riverGraphics.fillPoints(shadowPoly, true);

      // Main body fill
      this.riverGraphics.fillStyle(0x3a88e0, 0.80);
      const bodyPoly = [...leftPts, ...rightPts.slice().reverse()];
      this.riverGraphics.fillPoints(bodyPoly, true);

      // Bright highlight stripe (narrow, centred)
      this.riverGraphics.lineStyle(1.0, 0x90c8f8, 0.45);
      this.riverGraphics.beginPath();
      this.riverGraphics.moveTo(smooth[0].x, smooth[0].y);
      for (let i = 1; i < n; i++) this.riverGraphics.lineTo(smooth[i].x, smooth[i].y);
      this.riverGraphics.strokePath();

      // Delta / harbour fan where the river meets ocean or coast
      const last = river[river.length - 1];
      if (tiles[last.y]?.[last.x]?.type === 'ocean' || tiles[last.y]?.[last.x]?.type === 'coast') {
        drawRiverDelta(this.riverGraphics, smooth, MAX_W);
      }
    }
  }

  // ─── World-space vegetation ───────────────────────────────────────────────────

  /** Draws large trees in world-space on all forest tiles so they cross tile
   *  boundaries freely, eliminating the visible grid. Redrawn each season. */
  private renderVegetation() {
    this.vegetationLayer.clear();
    const { tiles, width, height } = this.world;
    const season = this.currentSeasonIndex;
    const palettes = VEG_PALETTES[season];

    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty][tx].type !== 'forest') continue;

        // Position-stable layout seed — same tree positions every season
        const layoutRng = makeRng((tx * 3571 + ty * 4297 + 13) >>> 0);
        // Season-dependent visual seed — controls leaf colour, snow etc.
        const visualRng  = makeRng((tx * 7919 + ty * 6271 + season * 1013) >>> 0);

        const count = 3 + Math.floor(layoutRng() * 3); // 3–5 trees per tile
        for (let i = 0; i < count; i++) {
          // Allow ~8 % bleed beyond each tile edge so canopies cross boundaries
          const wx = (tx + layoutRng() * 1.08 - 0.04) * TILE_SIZE;
          const wy = (ty + layoutRng() * 1.08 - 0.04) * TILE_SIZE;
          const isConifer = layoutRng() < 0.28;
          const palIdx    = Math.floor(layoutRng() * 4);
          const radius    = 26 + layoutRng() * 22; // 26–48 px

          if (isConifer) {
            vegConifer(this.vegetationLayer, wx, wy, visualRng, season === 3);
          } else if (season === 3) {
            vegBareTree(this.vegetationLayer, wx, wy, visualRng);
          } else {
            vegBroadleaf(this.vegetationLayer, wx, wy, radius,
              palettes[palIdx % palettes.length], visualRng);
          }
        }
      }
    }

    // Scatter occasional solitary trees on non-forest tiles
    const SCATTER_CHANCE: Partial<Record<string, number>> = {
      plains: 0.22, coast: 0.10, wetland: 0.14, mountain: 0.05,
    };
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const tileType = tiles[ty][tx].type;
        const chance = SCATTER_CHANCE[tileType];
        if (!chance) continue;

        const layoutRng = makeRng((tx * 5003 + ty * 6661 + 99) >>> 0);
        if (layoutRng() >= chance) continue;

        const visualRng = makeRng((tx * 8191 + ty * 5749 + season * 997) >>> 0);
        const count = 1 + Math.floor(layoutRng() * (tileType === 'plains' ? 2 : 1));
        for (let i = 0; i < count; i++) {
          const wx = (tx + 0.05 + layoutRng() * 0.90) * TILE_SIZE;
          const wy = (ty + 0.05 + layoutRng() * 0.90) * TILE_SIZE;
          const isConifer = tileType === 'mountain' || layoutRng() < 0.25;
          const palIdx    = Math.floor(layoutRng() * 4);
          const radius    = 14 + layoutRng() * 14; // 14–28 px
          if (isConifer) {
            vegConifer(this.vegetationLayer, wx, wy, visualRng, season === 3);
          } else if (season === 3) {
            vegBareTree(this.vegetationLayer, wx, wy, visualRng);
          } else {
            vegBroadleaf(this.vegetationLayer, wx, wy, radius,
              palettes[palIdx % palettes.length], visualRng);
          }
        }
      }
    }
  }

  // ─── Territory + building overlays ───────────────────────────────────────────

  private renderOverlays(allDuchies: Duchy[]) {
    this.territoryOverlay.clear();
    this.buildingSprites.forEach(s => s.destroy());
    this.buildingSprites = [];

    for (const duchy of allDuchies) {
      const color = parseInt(duchy.color.replace('#', ''), 16);
      const ownedSet = new Set(duchy.tiles.map(({ x, y }) => `${x},${y}`));

      // Territory fill (semi-transparent)
      this.territoryOverlay.fillStyle(color, 0.15);
      for (const { x, y } of duchy.tiles) {
        this.territoryOverlay.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }

      // Territory border
      this.territoryOverlay.lineStyle(3, color, 1.0);
      for (const { x, y } of duchy.tiles) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        if (!ownedSet.has(`${x},${y - 1}`)) this.territoryOverlay.lineBetween(px, py, px + TILE_SIZE, py);
        if (!ownedSet.has(`${x},${y + 1}`)) this.territoryOverlay.lineBetween(px, py + TILE_SIZE, px + TILE_SIZE, py + TILE_SIZE);
        if (!ownedSet.has(`${x - 1},${y}`)) this.territoryOverlay.lineBetween(px, py, px, py + TILE_SIZE);
        if (!ownedSet.has(`${x + 1},${y}`)) this.territoryOverlay.lineBetween(px + TILE_SIZE, py, px + TILE_SIZE, py + TILE_SIZE);
      }

      // Roads connecting buildings via MST
      if (duchy.buildings.length >= 2) {
        const pts = duchy.buildings.map(b => ({ x: b.tileX, y: b.tileY }));
        const edges = computeMST(pts);
        this.territoryOverlay.lineStyle(7, 0x7a5828, 0.80);
        for (const [a, b] of edges) {
          const ax = (a.x + 0.5) * TILE_SIZE, ay = (a.y + 0.5) * TILE_SIZE;
          const bx = (b.x + 0.5) * TILE_SIZE, by = (b.y + 0.5) * TILE_SIZE;
          this.territoryOverlay.lineBetween(ax, ay, bx, by);
        }
        // Thin highlight stripe on roads
        this.territoryOverlay.lineStyle(2, 0xc0a060, 0.35);
        for (const [a, b] of edges) {
          const ax = (a.x + 0.5) * TILE_SIZE, ay = (a.y + 0.5) * TILE_SIZE;
          const bx = (b.x + 0.5) * TILE_SIZE, by = (b.y + 0.5) * TILE_SIZE;
          this.territoryOverlay.lineBetween(ax, ay, bx, by);
        }
      }

      // Building sprites — interactive so they relay clicks to their tile
      for (const building of duchy.buildings) {
        const bx = building.tileX;
        const by = building.tileY;
        const sprite = this.add.image(
          bx * TILE_SIZE,
          by * TILE_SIZE,
          `building-${building.type}`,
        ).setOrigin(0, 0).setDepth(2).setInteractive();

        sprite.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (this.dragMoved) return;
          const ev = pointer.event as MouseEvent;
          const el = document.elementFromPoint(ev.clientX, ev.clientY);
          if (el?.closest('.panel, .hud-bar')) return;
          useUIStore.getState().setSelectedTile({ x: bx, y: by });
        });

        this.buildingSprites.push(sprite);
      }
    }
  }

  // ─── Camera + input ──────────────────────────────────────────────────────────

  private setupCamera() {
    const mapWidth = this.world.width * TILE_SIZE;
    const mapHeight = this.world.height * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(mapWidth / 2, mapHeight / 2);
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragScreenStartX = p.x;
      this.dragScreenStartY = p.y;
      this.dragStartX = p.x + this.cameras.main.scrollX;
      this.dragStartY = p.y + this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      if (Math.abs(p.x - this.dragScreenStartX) > 5 || Math.abs(p.y - this.dragScreenStartY) > 5) {
        this.dragMoved = true;
      }
      this.cameras.main.scrollX = this.dragStartX - p.x;
      this.cameras.main.scrollY = this.dragStartY - p.y;
    });

    this.input.on('pointerup', () => { this.isDragging = false; });

    this.input.on('wheel', (_p: any, _gos: any, _dx: any, dy: number) => {
      const zoom = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom - dy * 0.001, 0.3, 3));
    });
  }

  update() {
    const speed = 8 / this.cameras.main.zoom;
    if (this.cursors.left.isDown)  this.cameras.main.scrollX -= speed;
    if (this.cursors.right.isDown) this.cameras.main.scrollX += speed;
    if (this.cursors.up.isDown)    this.cameras.main.scrollY -= speed;
    if (this.cursors.down.isDown)  this.cameras.main.scrollY += speed;
  }
}

// ─── MST (Prim's) for road layout ─────────────────────────────────────────────

function computeMST(
  pts: { x: number; y: number }[],
): [{ x: number; y: number }, { x: number; y: number }][] {
  if (pts.length < 2) return [];
  const edges: [{ x: number; y: number }, { x: number; y: number }][] = [];
  const inMST = new Set([0]);
  while (inMST.size < pts.length) {
    let bestDist = Infinity, bestI = -1, bestJ = -1;
    for (const i of inMST) {
      for (let j = 0; j < pts.length; j++) {
        if (inMST.has(j)) continue;
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; bestI = i; bestJ = j; }
      }
    }
    if (bestJ === -1) break;
    edges.push([pts[bestI], pts[bestJ]]);
    inMST.add(bestJ);
  }
  return edges;
}

// ─── Catmull-Rom spline helper ────────────────────────────────────────────────
function catmullRom(
  pts: { x: number; y: number }[],
  samples: number,
): { x: number; y: number }[] {
  if (pts.length < 2) return pts;
  const n = pts.length;
  const out: { x: number; y: number }[] = [];

  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];

    for (let k = 0; k < samples; k++) {
      const t  = k / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y) * t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[n - 1]);
  return out;
}

// ─── Seeded RNG (mulberry32) ──────────────────────────────────────────────────
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── River polygon helpers ────────────────────────────────────────────────────

/** Build a closed polygon for a river path with a given min/max half-width. */
function buildWidenedPoly(
  smooth: { x: number; y: number }[],
  minW: number,
  maxW: number,
): { x: number; y: number }[] {
  const n = smooth.length;
  const left:  { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];

  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const halfW = (minW + (maxW - minW) * t) / 2;
    const prev = smooth[Math.max(0, i - 1)];
    const next = smooth[Math.min(n - 1, i + 1)];
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len, py = dx / len;
    left.push ({ x: smooth[i].x + px * halfW, y: smooth[i].y + py * halfW });
    right.push({ x: smooth[i].x - px * halfW, y: smooth[i].y - py * halfW });
  }
  return [...left, ...right.slice().reverse()];
}

/** Draws a delta / harbour fan at the river mouth. Fans out 4 arms in the
 *  direction of the last segment, tapering quickly into the ocean. */
function drawRiverDelta(
  g: Phaser.GameObjects.Graphics,
  smooth: { x: number; y: number }[],
  mouthWidth: number,
): void {
  const n = smooth.length;
  if (n < 3) return;

  // Approximate terminal flow direction from the last few smooth points
  const tail  = smooth[n - 1];
  const back  = smooth[Math.max(0, n - 6)];
  const fdx   = tail.x - back.x;
  const fdy   = tail.y - back.y;
  const flen  = Math.sqrt(fdx * fdx + fdy * fdy) || 1;
  const fx    = fdx / flen;   // unit vector in flow direction
  const fy    = fdy / flen;

  const ARM_COUNT   = 4;
  const ARM_LENGTH  = TILE_SIZE * 1.2;
  const ARM_SPREAD  = 0.55; // total angular spread (radians) across all arms

  for (let a = 0; a < ARM_COUNT; a++) {
    // Angle offset: spread arms symmetrically around the flow direction
    const angOffset = (a / (ARM_COUNT - 1) - 0.5) * ARM_SPREAD;
    const cosA = Math.cos(angOffset), sinA = Math.sin(angOffset);
    const ax   = fx * cosA - fy * sinA;
    const ay   = fx * sinA + fy * cosA;

    // Taper: outermost arms are shorter and narrower
    const edgeFactor = 1 - Math.abs(a / (ARM_COUNT - 1) - 0.5) * 0.9;
    const armLen  = ARM_LENGTH * edgeFactor;
    const baseW   = mouthWidth * edgeFactor * 0.65;

    const tipX = tail.x + ax * armLen;
    const tipY = tail.y + ay * armLen;

    // Perpendicular at the base
    const px = -ay, py = ax;

    const poly = [
      { x: tail.x + px * baseW,  y: tail.y + py * baseW  },
      { x: tail.x - px * baseW,  y: tail.y - py * baseW  },
      { x: tipX,                 y: tipY                  },
    ];

    g.fillStyle(0x3a88e0, 0.55 * edgeFactor);
    g.fillPoints(poly, true);
    // Faint highlight
    g.fillStyle(0x90c8f8, 0.2 * edgeFactor);
    g.fillPoints([
      { x: tail.x + px * baseW * 0.2, y: tail.y + py * baseW * 0.2 },
      { x: tail.x - px * baseW * 0.2, y: tail.y - py * baseW * 0.2 },
      { x: tipX,                      y: tipY                       },
    ], true);
  }
}

// ─── World-space vegetation palettes & drawers (Phaser Graphics) ─────────────

interface VegPalette { base: number; mid: number; hi: number; trunk: number; }

const VEG_PALETTES: VegPalette[][] = [
  // Spring — fresh greens + cherry blossom
  [
    { base: 0x2d6a2d, mid: 0x4a9440, hi: 0x7abf50, trunk: 0x5a3a1a },
    { base: 0x3a7228, mid: 0x58a040, hi: 0x8ad458, trunk: 0x4a3218 },
    { base: 0x2d6040, mid: 0x3e8a58, hi: 0x60b878, trunk: 0x3a2a18 },
    { base: 0x7a3868, mid: 0xb05888, hi: 0xe090b8, trunk: 0x5a2a40 },
  ],
  // Summer — deep saturated greens
  [
    { base: 0x1a5a1a, mid: 0x2d8030, hi: 0x5aad40, trunk: 0x4a3218 },
    { base: 0x245a18, mid: 0x388a28, hi: 0x60b040, trunk: 0x3e2814 },
    { base: 0x2d6a2d, mid: 0x4a9440, hi: 0x7abf50, trunk: 0x5a3a1a },
    { base: 0x1a6a3a, mid: 0x2d9058, hi: 0x50b878, trunk: 0x3a2a18 },
  ],
  // Fall — oranges, reds, golds
  [
    { base: 0x8a3a10, mid: 0xc05a20, hi: 0xe88030, trunk: 0x5a2e10 },
    { base: 0x8a2010, mid: 0xb04020, hi: 0xd06030, trunk: 0x5a2010 },
    { base: 0x8a7a10, mid: 0xc0a820, hi: 0xe8c830, trunk: 0x5a4a10 },
    { base: 0x6a4a10, mid: 0x8a6a30, hi: 0xb08040, trunk: 0x4a3010 },
  ],
  // Winter — bare/conifer handled by type, but fallback palette if needed
  [{ base: 0x2a3a1a, mid: 0x3a5a28, hi: 0x5a7a40, trunk: 0x4a3218 }],
];

function vegBroadleaf(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number, radius: number,
  p: VegPalette, rng: () => number,
) {
  // Drop shadow
  g.fillStyle(0x000000, 0.20);
  g.fillEllipse(cx + radius * 0.12, cy + radius * 0.18, radius * 2.0, radius * 1.2);
  // Canopy base
  g.fillStyle(p.base, 1.0);
  g.fillCircle(cx, cy, radius);
  // Midtone blobs
  const blobs = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const ang = rng() * Math.PI * 2;
    const d   = rng() * radius * 0.52;
    const br  = radius * (0.28 + rng() * 0.34);
    g.fillStyle(p.mid, 0.82);
    g.fillCircle(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, br);
  }
  // Specular highlight
  g.fillStyle(p.hi, 0.50);
  g.fillCircle(cx - radius * 0.32, cy - radius * 0.34, radius * 0.50);
  // Depth shadow
  g.fillStyle(0x000000, 0.28);
  g.fillCircle(cx + radius * 0.28, cy + radius * 0.30, radius * 0.44);
  // Trunk — drawn last so it shows below the canopy
  const tw = radius * 0.13;
  g.fillStyle(0x000000, 0.18);
  g.fillRect(cx - tw + 2, cy + radius * 0.72 + 2, tw * 2, radius * 0.55);
  g.fillStyle(p.trunk, 1.0);
  g.fillRect(cx - tw, cy + radius * 0.72, tw * 2, radius * 0.55);
}

function vegConifer(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rng: () => number, snow: boolean,
) {
  const h = 52 + rng() * 26;
  const w = h * 0.44;
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(cx + 4, cy + h * 0.42, w * 1.9, h * 0.38);
  g.fillStyle(0x1a4a38, 1.0);
  g.fillTriangle(cx, cy - h * 0.50, cx - w, cy + h * 0.42, cx + w, cy + h * 0.42);
  g.fillStyle(0x2a6a50, 0.90);
  g.fillTriangle(cx, cy - h * 0.48, cx - w * 0.70, cy + h * 0.26, cx + w * 0.70, cy + h * 0.26);
  g.fillStyle(0x3e8860, 0.55);
  g.fillTriangle(cx, cy - h * 0.46, cx - w * 0.36, cy, cx + w * 0.36, cy);
  if (snow) {
    g.fillStyle(0xe1eeff, 0.80);
    g.fillTriangle(cx, cy - h * 0.50 + 2, cx - w * 0.50, cy - h * 0.14, cx + w * 0.50, cy - h * 0.14);
  }
}

function vegBareTree(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rng: () => number,
) {
  const h  = 44 + rng() * 22;
  const tw = 3.0 + rng() * 2.5;
  g.fillStyle(0x000000, 0.14);
  g.fillEllipse(cx + 2, cy + h * 0.46, tw * 3.5, tw * 1.6);
  g.lineStyle(tw, 0x3a2a16, 0.90);
  g.lineBetween(cx, cy + h * 0.46, cx, cy - h * 0.46);
  const branches = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < branches; i++) {
    const by   = cy - h * 0.46 + h * (0.20 + rng() * 0.72);
    const bLen = 14 + rng() * 20;
    const dir  = rng() > 0.5 ? 1 : -1;
    g.lineStyle(1.2 + rng() * 1.4, 0x3a2a16, 0.72);
    g.lineBetween(cx, by, cx + dir * bLen, by - 5 - rng() * 10);
  }
}

// ─── Biome transition decoration helpers ─────────────────────────────────────

function transitionTree(
  g: Phaser.GameObjects.Graphics,
  px: number, py: number,
  rng: () => number, season: number,
): void {
  const isConifer = rng() < 0.28;
  const radius    = 20 + rng() * 18; // 20–38 px — properly sized for blending
  if (isConifer) {
    vegConifer(g, px, py, rng, season === 3);
  } else if (season === 3) {
    vegBareTree(g, px, py, rng);
  } else {
    const pals   = VEG_PALETTES[season];
    const palIdx = Math.floor(rng() * 4) % pals.length;
    vegBroadleaf(g, px, py, radius, pals[palIdx], rng);
  }
}

function transitionRock(
  g: Phaser.GameObjects.Graphics,
  px: number, py: number,
  rng: () => number, season: number,
): void {
  const rx  = 3 + rng() * 5;
  const ry  = rx * (0.55 + rng() * 0.3);
  const col = season === 3 ? 0x909090 : 0x7a7060;
  const hl  = season === 3 ? 0xc8c8c0 : 0xb0a898;

  g.fillStyle(0x000000, 0.16);
  g.fillEllipse(px + 2, py + 2, rx * 2, ry * 2);
  g.fillStyle(col, 0.88);
  g.fillEllipse(px, py, rx * 2, ry * 2);
  g.fillStyle(hl, 0.50);
  g.fillCircle(px - rx * 0.3, py - ry * 0.3, rx * 0.42);
}

function transitionReed(
  g: Phaser.GameObjects.Graphics,
  px: number, py: number,
  rng: () => number, season: number,
): void {
  const col = season === 2 ? 0x8c6e32 : season === 3 ? 0x7a7060 : 0x6eaa50;
  g.lineStyle(1, col, 0.75);
  const count = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const ox = (rng() - 0.5) * 6;
    const h  = 6 + rng() * 7;
    g.beginPath();
    g.moveTo(px + ox, py);
    g.lineTo(px + ox + (rng() - 0.5) * 3, py - h);
    g.strokePath();
  }
}

function transitionDryGrass(
  g: Phaser.GameObjects.Graphics,
  px: number, py: number,
  rng: () => number, season: number,
): void {
  const col = season === 3 ? 0x909070 : 0xb89040;
  g.lineStyle(1, col, 0.68);
  const count = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const ox = (rng() - 0.5) * 7;
    const h  = 4 + rng() * 5;
    g.beginPath();
    g.moveTo(px + ox, py);
    g.lineTo(px + ox + (rng() - 0.5) * 3, py - h);
    g.strokePath();
  }
  if (rng() < 0.55) {
    g.fillStyle(0xa09070, 0.62);
    g.fillCircle(px + (rng() - 0.5) * 8, py + 2, 1.4 + rng() * 2);
  }
}

function transitionPebble(
  g: Phaser.GameObjects.Graphics,
  px: number, py: number,
  rng: () => number, _season: number,
): void {
  const count = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const ox  = (rng() - 0.5) * 10;
    const oy  = (rng() - 0.5) * 6;
    const r   = 1.2 + rng() * 2.5;
    // Vary between warm sand and cool grey pebbles
    const col = rng() < 0.5 ? 0x9a8a7a : 0xb0a890;
    g.fillStyle(col, 0.70);
    g.fillCircle(px + ox, py + oy, r);
  }
}

function transitionSparseGrass(
  g: Phaser.GameObjects.Graphics,
  px: number, py: number,
  rng: () => number, season: number,
): void {
  const col = season === 3 ? 0x808878 : season === 2 ? 0x8a7820 : 0x5a9a30;
  g.lineStyle(1, col, 0.68);
  const count = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const ox = (rng() - 0.5) * 6;
    const h  = 4 + rng() * 6;
    g.beginPath();
    g.moveTo(px + ox, py);
    g.lineTo(px + ox + (rng() - 0.5) * 3, py - h);
    g.strokePath();
  }
}

function transitionBeach(
  g: Phaser.GameObjects.Graphics,
  px: number, py: number,
  rng: () => number, season: number,
): void {
  const sandColor = season === 3 ? 0xb8a080 : 0xd4b464;
  const r = 6 + rng() * 10;
  // Shadow
  g.fillStyle(0x000000, 0.08);
  g.fillEllipse(px + 1.5, py + 1.5, r * 2.4, r * 1.4);
  // Sand patch
  g.fillStyle(sandColor, 0.70);
  g.fillEllipse(px, py, r * 2.4, r * 1.4);
  // Lighter highlight
  g.fillStyle(season === 3 ? 0xd0c0a0 : 0xe8d090, 0.45);
  g.fillEllipse(px - r * 0.25, py - r * 0.2, r * 1.3, r * 0.75);
  // Occasional shell or pebble
  if (rng() < 0.40) {
    const col = rng() < 0.5 ? 0xf0e0c8 : 0x909888;
    g.fillStyle(col, 0.65);
    g.fillCircle(px + (rng() - 0.5) * r * 1.2, py + (rng() - 0.5) * r * 0.7, 1.0 + rng() * 1.8);
  }
}

function transitionWaterEdge(
  g: Phaser.GameObjects.Graphics,
  px: number, py: number,
  rng: () => number, season: number,
): void {
  const r = 5 + rng() * 9;
  if (rng() < 0.55) {
    // Bleed water pool
    const waterColor = season === 3 ? 0x7aa8b8 : 0x2a6890;
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(px + 1.5, py + 1.5, r * 2.2, r * 1.2);
    g.fillStyle(waterColor, 0.55);
    g.fillEllipse(px, py, r * 2.2, r * 1.2);
    g.fillStyle(season === 3 ? 0xbce0f0 : 0x60b0d0, 0.30);
    g.fillEllipse(px - r * 0.22, py - r * 0.18, r * 1.1, r * 0.6);
  } else {
    // Muddy reed patch
    g.fillStyle(season === 3 ? 0x506060 : 0x3a5830, 0.45);
    g.fillEllipse(px, py, r * 2.6, r * 1.3);
    transitionReed(g, px, py, rng, season);
  }
}
