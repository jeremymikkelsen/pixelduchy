import Phaser from 'phaser';
import { generateWorld } from '../procgen/worldgen';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { TILE_SIZE, NUM_TILE_VARIANTS, getSeasonIndex } from '../procgen/tileRenderer';
import type { WorldMap, Tile, Duchy, TileType } from '../../types';

// ─── Mountain cluster data (computed from tiles at render time) ────────────────
interface MountainCluster {
  tiles: { x: number; y: number }[];
  interiorDepth: Map<string, number>;
  maxDepth: number;
  size: number;
  tier: 0 | 1 | 2;          // 0=small(1-8), 1=medium(9-24), 2=tall(25+)
  mainSummit: { x: number; y: number };
  secondarySummits: { x: number; y: number }[];
}

/**
 * MapScene - renders the game world tilemap and handles camera/input.
 */
export class MapScene extends Phaser.Scene {
  private world!: WorldMap;
  private tileLayer!: Phaser.GameObjects.RenderTexture;
  // Static overlay layers: baked to RenderTextures so scrolling costs ~6 GPU vertices
  // instead of re-executing thousands of draw commands every frame.
  private biomeTransitionLayer!: Phaser.GameObjects.RenderTexture;
  private beachLayer!: Phaser.GameObjects.RenderTexture;
  private vegetationLayer!: Phaser.GameObjects.RenderTexture;
  private mountainLayer!: Phaser.GameObjects.RenderTexture;
  // Dynamic layers (redrawn each turn / state-update)
  private territoryLayer!: Phaser.GameObjects.RenderTexture;
  private riverLayer!: Phaser.GameObjects.RenderTexture;
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

  constructor() {
    super({ key: 'MapScene' });
  }

  create() {
    const existingSession = useGameStore.getState().session;
    this.world = existingSession?.map ?? generateWorld({ width: 80, height: 80, seed: Date.now() });
    this.currentSeasonIndex = getSeasonIndex(existingSession?.turnNumber ?? 1);

    // Static overlays baked to RenderTextures — drawn once per update then
    // replayed as a single textured quad every frame (no per-frame command replay).
    // Tile layer is full-res; overlay layers are half-res (displayed at scale 2).
    const worldW = this.world.width * TILE_SIZE;
    const worldH = this.world.height * TILE_SIZE;
    const rtW = Math.ceil(worldW / 2);
    const rtH = Math.ceil(worldH / 2);
    this.tileLayer            = this.add.renderTexture(0, 0, worldW, worldH).setOrigin(0, 0).setDepth(0);
    this.biomeTransitionLayer = this.add.renderTexture(0, 0, rtW, rtH).setDepth(0.35).setOrigin(0, 0).setScale(2);
    this.beachLayer           = this.add.renderTexture(0, 0, rtW, rtH).setDepth(0.42).setOrigin(0, 0).setScale(2);
    this.riverLayer           = this.add.renderTexture(0, 0, rtW, rtH).setDepth(0.5).setOrigin(0, 0).setScale(2);
    this.vegetationLayer      = this.add.renderTexture(0, 0, rtW, rtH).setDepth(0.55).setOrigin(0, 0).setScale(2);
    this.mountainLayer        = this.add.renderTexture(0, 0, rtW, rtH).setDepth(0.60).setOrigin(0, 0).setScale(2);
    this.territoryLayer       = this.add.renderTexture(0, 0, rtW, rtH).setDepth(1).setOrigin(0, 0).setScale(2);

    this.renderTileLayer();
    this.renderBiomeTransitions();
    this.renderBeach();
    this.renderRivers();
    this.renderVegetation();
    this.renderMountains();
    this.setupCamera();
    this.setupInput();

    this.scene.launch('UIScene');

    let prevDuchies = useGameStore.getState().allDuchies;
    this.unsubscribeStore = useGameStore.subscribe((state) => {
      const newMap = state.session?.map;
      if (newMap && newMap !== this.world) {
        this.world = newMap;
        this.tileLayer.clear();
        this.renderTileLayer();
        this.renderBiomeTransitions();
        this.renderBeach();
        this.renderRivers();
        this.renderVegetation();
        this.renderMountains();
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
        this.renderTileLayer();
        this.renderBiomeTransitions();
        this.renderBeach();
        this.renderVegetation();
        this.renderMountains();
        // Rivers are permanent — no re-bake on season change
      }

      if (state.allDuchies !== prevDuchies) {
        prevDuchies = state.allDuchies;
        this.renderOverlays(state.allDuchies);
      }
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

  /** Bakes all tiles into a single full-res RenderTexture (one draw call per frame). */
  private renderTileLayer() {
    const { tiles, width, height } = this.world;
    this.tileLayer.beginDraw();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.tileLayer.batchDrawFrame(
          this.tileKey(tiles[y][x].type, x, y), undefined, x * TILE_SIZE, y * TILE_SIZE,
        );
      }
    }
    this.tileLayer.endDraw();
  }

  // ─── Biome transition decoration ─────────────────────────────────────────────

  /** Draws procedural decorations near biome boundaries — a sparse overlay layer
   *  placed between biome tiles (depth 0.35) and rivers (depth 0.5). */
  private renderBiomeTransitions() {
    const g = this.make.graphics({}, false);
    const { tiles, width, height } = this.world;
    const season = this.currentSeasonIndex;
    const TS = TILE_SIZE;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tiles[y][x];
        if (tile.type === 'ocean' || tile.type === 'coast') continue;

        const dirs = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        ] as const;

        for (const { dx, dy } of dirs) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = tiles[ny][nx];
          // Skip same-type, ocean, and coast (beach overlay handles coast boundaries)
          if (neighbor.type === tile.type || neighbor.type === 'ocean' || neighbor.type === 'coast') continue;

          // Unique, reproducible seed per directed edge (tile → neighbor direction)
          const rng = makeRng(((x * 7919 + y * 6271 + (dx + 2) * 3581 + (dy + 2) * 4127) * 2053) >>> 0);

          // Centre of the shared edge in pixel space
          const edgeCX = (x + 0.5 + dx * 0.5) * TS;
          const edgeCY = (y + 0.5 + dy * 0.5) * TS;

          const isForestEdge  = tile.type === 'forest'  || neighbor.type === 'forest';
          const isWetlandEdge = tile.type === 'wetland' || neighbor.type === 'wetland';
          const count = isForestEdge  ? 4 + Math.floor(rng() * 3)
                      : isWetlandEdge ? 3 + Math.floor(rng() * 3)
                      : 2 + Math.floor(rng() * 2);
          for (let i = 0; i < count; i++) {
            const along = (rng() - 0.5) * (TS - 10);
            const depth = isForestEdge  ? 14 + rng() * 36
                        : isWetlandEdge ? 8  + rng() * 28
                        : 6 + rng() * 14;
            // Normal into tile = (-dx, -dy); perpendicular along edge = (-dy, dx)
            const px = edgeCX + (-dy) * along - dx * depth;
            const py = edgeCY + ( dx) * along - dy * depth;

            this.drawTransitionDecoration(g, tile.type, neighbor.type, px, py, rng, season);
          }
        }
      }
    }

    this.biomeTransitionLayer.clear();
    g.setScale(0.5);
    this.biomeTransitionLayer.draw(g, 0, 0);
    g.destroy();
  }

  private drawTransitionDecoration(
    g: Phaser.GameObjects.Graphics,
    fromType: TileType, toType: TileType,
    px: number, py: number,
    rng: () => number, season: number,
  ): void {
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
      default:
        break;
    }
  }

  // ─── River rendering ─────────────────────────────────────────────────────────

  private renderRivers() {
    const g = this.make.graphics({}, false);
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
      const MIN_W = 4.5;
      const MAX_W = 30.0;
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
      g.fillStyle(0x2060b0, 0.18);
      const shadowPoly = buildWidenedPoly(smooth, MIN_W + 3, MAX_W + 6);
      g.fillPoints(shadowPoly, true);

      // Main body fill
      g.fillStyle(0x3a88e0, 0.80);
      const bodyPoly = [...leftPts, ...rightPts.slice().reverse()];
      g.fillPoints(bodyPoly, true);

      // Bright highlight stripe (narrow, centred)
      g.lineStyle(1.0, 0x90c8f8, 0.45);
      g.beginPath();
      g.moveTo(smooth[0].x, smooth[0].y);
      for (let i = 1; i < n; i++) g.lineTo(smooth[i].x, smooth[i].y);
      g.strokePath();

      // Delta / harbour fan where the river meets ocean or coast
      const last = river[river.length - 1];
      if (tiles[last.y]?.[last.x]?.type === 'ocean' || tiles[last.y]?.[last.x]?.type === 'coast') {
        drawRiverDelta(g, smooth, MAX_W);
      }
    }

    this.riverLayer.clear();
    g.setScale(0.5);
    this.riverLayer.draw(g, 0, 0);
    g.destroy();
  }

  // ─── World-space vegetation ───────────────────────────────────────────────────

  /** Draws large trees in world-space on all forest tiles so they cross tile
   *  boundaries freely, eliminating the visible grid. Redrawn each season.
   *  Also draws wetland ponds and skips trees on coast-adjacent tiles. */
  private renderVegetation() {
    const g = this.make.graphics({}, false);
    const { tiles, width, height } = this.world;
    const season = this.currentSeasonIndex;
    const palettes = VEG_PALETTES[season];
    const TS = TILE_SIZE;

    // ── Wetland ponds (drawn first so trees render on top of pond edges)
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty][tx].type !== 'wetland') continue;
        const pondRng = makeRng((tx * 5923 + ty * 6791 + 17) >>> 0);
        if (pondRng() >= 0.25) continue; // 25% of wetland tiles get a pond

        const px = (tx + 0.12 + pondRng() * 0.76) * TS;
        const py = (ty + 0.12 + pondRng() * 0.76) * TS;
        const rx = 22 + pondRng() * 30;
        const ry = rx * (0.38 + pondRng() * 0.24); // flattened for 3/4 view

        const waterCol = season === 3 ? 0x6898b8 : 0x2a6890;
        // Shadow
        g.fillStyle(0x000000, 0.14);
        g.fillEllipse(px + 2, py + 3, rx * 2.1, ry * 2.1);
        // Pond body
        g.fillStyle(waterCol, 0.82);
        g.fillEllipse(px, py, rx * 2, ry * 2);
        // Reflection highlight
        g.fillStyle(season === 3 ? 0x9cc0d8 : 0x60b0d8, 0.38);
        g.fillEllipse(px - rx * 0.22, py - ry * 0.24, rx * 1.1, ry * 0.65);
        // Edge reeds
        const reedCount = 2 + Math.floor(pondRng() * 4);
        for (let r = 0; r < reedCount; r++) {
          const ang  = pondRng() * Math.PI * 2;
          const dist = rx * (0.78 + pondRng() * 0.28);
          transitionReed(g, px + Math.cos(ang) * dist, py + Math.sin(ang) * (ry / rx) * dist, pondRng, season);
        }
      }
    }

    // Helper: returns true if any 4-directional neighbor is coast or ocean
    const adjToWater = (tx: number, ty: number): boolean =>
      [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => {
        const t = tiles[ty + dy]?.[tx + dx];
        return t?.type === 'coast' || t?.type === 'ocean';
      });

    // ── Forest trees (dense, bleed slightly across tile boundaries)
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty][tx].type !== 'forest') continue;
        if (adjToWater(tx, ty)) continue; // no bleed onto beach

        const layoutRng = makeRng((tx * 3571 + ty * 4297 + 13) >>> 0);
        const visualRng = makeRng((tx * 7919 + ty * 6271 + season * 1013) >>> 0);

        const count = 3 + Math.floor(layoutRng() * 3);
        for (let i = 0; i < count; i++) {
          const wx = (tx + layoutRng() * 1.08 - 0.04) * TS;
          const wy = (ty + layoutRng() * 1.08 - 0.04) * TS;
          // Extra safety: skip if this pixel falls on coast/ocean tile
          const wtx = Math.floor(wx / TS), wty = Math.floor(wy / TS);
          const wType = tiles[wty]?.[wtx]?.type;
          if (wType === 'coast' || wType === 'ocean') continue;

          const isConifer = layoutRng() < 0.28;
          const radius    = 26 + layoutRng() * 22;
          if (isConifer) {
            vegConifer(g, wx, wy, visualRng, season === 3);
          } else if (season === 3) {
            vegBareTree(g, wx, wy, visualRng);
          } else {
            vegBroadleaf(g, wx, wy, radius, palettes[Math.floor(layoutRng() * 4) % palettes.length], visualRng);
          }
        }
      }
    }

    // ── Scatter solitary trees on non-forest tiles (coast and ocean excluded)
    const SCATTER_CHANCE: Partial<Record<string, number>> = {
      plains: 0.22, wetland: 0.14, mountain: 0.05,
    };
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const tileType = tiles[ty][tx].type;
        const chance = SCATTER_CHANCE[tileType];
        if (!chance) continue;
        if (adjToWater(tx, ty)) continue; // keep trees off coast-adjacent tiles

        const layoutRng = makeRng((tx * 5003 + ty * 6661 + 99) >>> 0);
        if (layoutRng() >= chance) continue;

        const visualRng = makeRng((tx * 8191 + ty * 5749 + season * 997) >>> 0);
        const count = 1 + Math.floor(layoutRng() * (tileType === 'plains' ? 2 : 1));
        for (let i = 0; i < count; i++) {
          const wx = (tx + 0.05 + layoutRng() * 0.90) * TS;
          const wy = (ty + 0.05 + layoutRng() * 0.90) * TS;
          const isConifer = tileType === 'mountain' || layoutRng() < 0.25;
          const radius    = 14 + layoutRng() * 14;
          if (isConifer) {
            vegConifer(g, wx, wy, visualRng, season === 3);
          } else if (season === 3) {
            vegBareTree(g, wx, wy, visualRng);
          } else {
            vegBroadleaf(g, wx, wy, radius, palettes[Math.floor(layoutRng() * 4) % palettes.length], visualRng);
          }
        }
      }
    }

    this.vegetationLayer.clear();
    g.setScale(0.5);
    this.vegetationLayer.draw(g, 0, 0);
    g.destroy();
  }

  // ─── Mountain peaks ───────────────────────────────────────────────────────────

  /** Bakes mountain overlays using procedural height-field generation + isometric
   *  projection. Each connected cluster gets its own MountainGenData pass, then
   *  the depth-sorted triangles are drawn into the shared RenderTexture. */
  private renderMountains() {
    const g = this.make.graphics({}, false);
    const { tiles, width, height } = this.world;
    const clusters = computeMountainClusters(tiles, width, height);
    const season = this.currentSeasonIndex;

    for (const cluster of clusters) {
      // Bounding box of cluster tiles in tile coordinates.
      let minTX = Infinity, minTY = Infinity, maxTX = -Infinity, maxTY = -Infinity;
      for (const pt of cluster.tiles) {
        if (pt.x < minTX) minTX = pt.x;
        if (pt.y < minTY) minTY = pt.y;
        if (pt.x > maxTX) maxTX = pt.x;
        if (pt.y > maxTY) maxTY = pt.y;
      }
      const clusterW = maxTX - minTX + 1;
      const clusterH = maxTY - minTY + 1;

      // Seed from main summit position (deterministic per cluster).
      const seed = (cluster.mainSummit.x * 7919 + cluster.mainSummit.y * 6271) >>> 0;

      // Generate height+shade field, then project + draw it.
      const mtnData = generateMountainData(clusterW, clusterH, seed, cluster.tier);
      const anchorX = (minTX + clusterW * 0.5) * TILE_SIZE;
      const anchorY = (maxTY + 1) * TILE_SIZE;
      const clusterPixW = clusterW * TILE_SIZE;
      const clusterPixH = clusterH * TILE_SIZE;
      renderMountainProjection(g, mtnData, anchorX, anchorY, clusterPixW, clusterPixH, season);

      // Stone cliffs on ocean/coast-facing edges (drawn on top of the projection).
      for (const pt of cluster.tiles) {
        const adjacentToWater = [[-1,0],[1,0],[0,-1],[0,1]].some(([dx, dy]) => {
          const t = tiles[pt.y + dy]?.[pt.x + dx];
          return t?.type === 'ocean' || t?.type === 'coast';
        });
        if (adjacentToWater) {
          const rng = makeRng((pt.x * 7919 + pt.y * 6271 + 7) >>> 0);
          drawCliffFace(g, pt.x, pt.y, tiles, width, height, season, rng);
        }
      }
    }

    this.mountainLayer.clear();
    g.setScale(0.5);
    this.mountainLayer.draw(g, 0, 0);
    g.destroy();
  }

  // ─── Beach overlay ────────────────────────────────────────────────────────────

  /** Draws organic beach strips on all coast tiles as a world-space overlay layer
   *  (depth 0.42) so sand bleeds into adjacent land tiles. */
  private renderBeach() {
    const g = this.make.graphics({}, false);
    const { tiles, width, height } = this.world;
    const season = this.currentSeasonIndex;
    const TS = TILE_SIZE;
    const dirs4 = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    ] as const;

    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (tiles[ty][tx].type !== 'coast') continue;

        // Compute average "sea direction" (unit vector toward ocean/coast neighbors)
        let seaX = 0, seaY = 0;
        let hasMountainNeighbor = false;
        for (const { dx, dy } of dirs4) {
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            seaX += dx; seaY += dy; // treat map edge as ocean
            continue;
          }
          const n = tiles[ny][nx];
          if (n.type === 'ocean' || n.type === 'coast') { seaX += dx; seaY += dy; }
          if (n.type === 'mountain') hasMountainNeighbor = true;
        }
        const seaLen = Math.sqrt(seaX * seaX + seaY * seaY);
        if (seaLen < 0.1) continue; // fully surrounded — skip

        const snx = seaX / seaLen, sny = seaY / seaLen; // normalized sea direction
        const alongX = -sny, alongY = snx;               // perpendicular (along coast)
        const cx = (tx + 0.5) * TS, cy = (ty + 0.5) * TS;

        const layoutRng = makeRng((tx * 4969 + ty * 3491 + 7) >>> 0);
        drawBeachStrip(
          g, cx, cy,
          snx, sny, alongX, alongY,
          TS, layoutRng, season, hasMountainNeighbor,
        );
      }
    }

    this.beachLayer.clear();
    g.setScale(0.5);
    this.beachLayer.draw(g, 0, 0);
    g.destroy();
  }

  // ─── Territory + building overlays ───────────────────────────────────────────

  private renderOverlays(allDuchies: Duchy[]) {
    const g = this.make.graphics({}, false);
    this.buildingSprites.forEach(s => s.destroy());
    this.buildingSprites = [];

    for (const duchy of allDuchies) {
      const color = parseInt(duchy.color.replace('#', ''), 16);
      const ownedSet = new Set(duchy.tiles.map(({ x, y }) => `${x},${y}`));

      // Territory fill (semi-transparent)
      g.fillStyle(color, 0.15);
      for (const { x, y } of duchy.tiles) {
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }

      // Territory border
      g.lineStyle(3, color, 1.0);
      for (const { x, y } of duchy.tiles) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        if (!ownedSet.has(`${x},${y - 1}`)) g.lineBetween(px, py, px + TILE_SIZE, py);
        if (!ownedSet.has(`${x},${y + 1}`)) g.lineBetween(px, py + TILE_SIZE, px + TILE_SIZE, py + TILE_SIZE);
        if (!ownedSet.has(`${x - 1},${y}`)) g.lineBetween(px, py, px, py + TILE_SIZE);
        if (!ownedSet.has(`${x + 1},${y}`)) g.lineBetween(px + TILE_SIZE, py, px + TILE_SIZE, py + TILE_SIZE);
      }

      // Roads connecting buildings via MST
      if (duchy.buildings.length >= 2) {
        const pts = duchy.buildings.map(b => ({ x: b.tileX, y: b.tileY }));
        const edges = computeMST(pts);
        g.lineStyle(7, 0x7a5828, 0.80);
        for (const [a, b] of edges) {
          const ax = (a.x + 0.5) * TILE_SIZE, ay = (a.y + 0.5) * TILE_SIZE;
          const bx = (b.x + 0.5) * TILE_SIZE, by = (b.y + 0.5) * TILE_SIZE;
          g.lineBetween(ax, ay, bx, by);
        }
        // Thin highlight stripe on roads
        g.lineStyle(2, 0xc0a060, 0.35);
        for (const [a, b] of edges) {
          const ax = (a.x + 0.5) * TILE_SIZE, ay = (a.y + 0.5) * TILE_SIZE;
          const bx = (b.x + 0.5) * TILE_SIZE, by = (b.y + 0.5) * TILE_SIZE;
          g.lineBetween(ax, ay, bx, by);
        }
      }

      // Building sprites — interactive (hover cursor); clicks handled by scene-level handler
      for (const building of duchy.buildings) {
        const sprite = this.add.image(
          building.tileX * TILE_SIZE,
          building.tileY * TILE_SIZE,
          `building-${building.type}`,
        ).setOrigin(0, 0).setDepth(2).setInteractive();
        this.buildingSprites.push(sprite);
      }
    }

    this.territoryLayer.clear();
    g.setScale(0.5);
    this.territoryLayer.draw(g, 0, 0);
    g.destroy();
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

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = false;
      if (this.dragMoved) return;
      const ev = pointer.event as MouseEvent;
      if (document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.panel, .hud-bar')) return;
      const tx = Math.floor(pointer.worldX / TILE_SIZE);
      const ty = Math.floor(pointer.worldY / TILE_SIZE);
      if (tx < 0 || ty < 0 || tx >= this.world.width || ty >= this.world.height) return;
      useUIStore.getState().setSelectedTile({ x: tx, y: ty });
    });

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

// ─── Beach overlay helpers ────────────────────────────────────────────────────

/** Rotation-aware ellipse approximated via fillPoints (14 vertices).
 *  axisX/axisY is the major-axis unit vector; minor axis is (-axisY, axisX). */
function drawRotatedEllipse(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  axisX: number, axisY: number,
  color: number, alpha: number,
): void {
  const N = 14;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const a  = (i / N) * Math.PI * 2;
    const lx = Math.cos(a) * rx;
    const ly = Math.sin(a) * ry;
    pts.push({
      x: cx + lx * axisX - ly * axisY,
      y: cy + lx * axisY + ly * axisX,
    });
  }
  g.fillStyle(color, alpha);
  g.fillPoints(pts, true);
}

/** Tall beach grass tufts — 3–6 wind-bent blades. */
function drawDuneGrass(
  g: Phaser.GameObjects.Graphics,
  px: number, py: number,
  rng: () => number, season: number,
): void {
  const col = season === 3 ? 0x909880 : season === 2 ? 0xa09828 : 0xb8b830;
  const blades = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < blades; i++) {
    const ox   = (rng() - 0.5) * 10;
    const h    = 7 + rng() * 11;
    const tilt = (rng() - 0.5) * 8;
    g.lineStyle(1.0 + rng() * 0.8, col, 0.78);
    g.beginPath();
    g.moveTo(px + ox, py);
    g.lineTo(px + ox + tilt, py - h);
    g.strokePath();
  }
}

/** Main beach renderer for a single coast tile.
 *  seaX/seaY = unit vector toward ocean (normalised by caller).
 *  Depth is measured from the ocean-facing edge of the tile inward. */
function drawBeachStrip(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  seaX: number, seaY: number,
  alongX: number, alongY: number,
  TS: number,
  rng: () => number,
  season: number,
  rocky: boolean,
): void {
  if (rocky) {
    drawRockyCoast(g, cx, cy, seaX, seaY, alongX, alongY, TS, rng);
    return;
  }

  // Seasonal sand palette
  const wetSand = season === 3 ? 0xb0a080 : season === 2 ? 0xb89838 : 0xc4a850;
  const drySand = season === 3 ? 0xc8b888 : season === 2 ? 0xcbb858 : 0xdcc870;
  const sandHi  = season === 3 ? 0xd8ccaa : 0xead890;

  // Position helper: depth d from ocean-facing edge + along offset
  const pt = (d: number, along: number) => ({
    x: cx + seaX * 0.5 * TS - seaX * d + alongX * along,
    y: cy + seaY * 0.5 * TS - seaY * d + alongY * along,
  });

  // 1. Foam / breaker line (thin, near ocean edge)
  const foamN = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < foamN; i++) {
    const { x, y } = pt(rng() * TS * 0.14, (rng() - 0.5) * TS * 0.95);
    const rx = 28 + rng() * 24, ry = rx * (0.14 + rng() * 0.09);
    drawRotatedEllipse(g, x, y, rx, ry, alongX, alongY, 0xf4f0e4, 0.58);
  }

  // 2. Wet sand (darker golden, near ocean)
  const wetN = 7 + Math.floor(rng() * 5);
  for (let i = 0; i < wetN; i++) {
    const { x, y } = pt(TS * (0.06 + rng() * 0.52), (rng() - 0.5) * TS * 1.05);
    const rx = 44 + rng() * 40, ry = rx * (0.20 + rng() * 0.12);
    drawRotatedEllipse(g, x, y, rx, ry, alongX, alongY, wetSand, 0.72 + rng() * 0.12);
  }

  // 3. Dry sand (lighter, bleeds ~0.6 TS into adjacent land tile)
  const dryN = 8 + Math.floor(rng() * 6);
  for (let i = 0; i < dryN; i++) {
    const { x, y } = pt(TS * (0.38 + rng() * 0.72), (rng() - 0.5) * TS * 1.10);
    const rx = 50 + rng() * 46, ry = rx * (0.18 + rng() * 0.11);
    drawRotatedEllipse(g, x, y, rx, ry, alongX, alongY, drySand, 0.74 + rng() * 0.12);
  }

  // 4. Sand highlight (sparse, mid-beach)
  const hiN = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < hiN; i++) {
    const { x, y } = pt(TS * (0.45 + rng() * 0.40), (rng() - 0.5) * TS * 0.80);
    const rx = 28 + rng() * 24, ry = rx * (0.15 + rng() * 0.09);
    drawRotatedEllipse(g, x, y, rx, ry, alongX, alongY, sandHi, 0.32);
  }

  // 5. Dune grass tufts (land side of coast tile, bleeding into land)
  const grassN = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < grassN; i++) {
    const { x, y } = pt(TS * (0.70 + rng() * 0.55), (rng() - 0.5) * TS * 0.95);
    drawDuneGrass(g, x, y, rng, season);
  }

  // 6. Winter snow patches on upper beach
  if (season === 3) {
    const snowN = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < snowN; i++) {
      const { x, y } = pt(TS * (0.55 + rng() * 0.50), (rng() - 0.5) * TS * 0.70);
      const rx = 22 + rng() * 18, ry = rx * (0.17 + rng() * 0.10);
      drawRotatedEllipse(g, x, y, rx, ry, alongX, alongY, 0xe4eef8, 0.50);
    }
  }
}

/** Rocky shoreline for mountain-adjacent coast tiles. */
function drawRockyCoast(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  seaX: number, seaY: number,
  alongX: number, alongY: number,
  TS: number,
  rng: () => number,
): void {
  const count = 7 + Math.floor(rng() * 6);
  for (let i = 0; i < count; i++) {
    const d     = rng() * TS * 0.80;
    const along = (rng() - 0.5) * TS * 0.92;
    const bx    = cx + seaX * 0.5 * TS - seaX * d + alongX * along;
    const by    = cy + seaY * 0.5 * TS - seaY * d + alongY * along;
    const r     = 5 + rng() * 16;
    const N     = 5 + Math.floor(rng() * 4);
    const pts: { x: number; y: number }[] = [];
    for (let j = 0; j < N; j++) {
      const ang = (j / N) * Math.PI * 2;
      const rv  = r * (0.55 + rng() * 0.55);
      pts.push({ x: bx + Math.cos(ang) * rv, y: by + Math.sin(ang) * rv * 0.60 });
    }
    // Shadow
    g.fillStyle(0x000000, 0.14);
    g.fillPoints(pts.map(p => ({ x: p.x + 2, y: p.y + 2 })), true);
    // Rock body
    g.fillStyle(rng() < 0.4 ? 0x5a5848 : 0x6a6858, 0.88);
    g.fillPoints(pts, true);
    // Highlight
    g.fillStyle(0x9a9888, 0.40);
    g.fillCircle(bx - r * 0.22, by - r * 0.18, r * 0.36);
  }
}

// ─── Mountain cluster analysis ────────────────────────────────────────────────

/** Finds connected components of mountain tiles, computes interior depth,
 *  and locates the main summit (highest elevation) plus secondary summits. */
function computeMountainClusters(
  tiles: Tile[][],
  width: number,
  height: number,
): MountainCluster[] {
  const visited = new Uint8Array(width * height);
  const clusters: MountainCluster[] = [];
  const DIRS: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].type !== 'mountain' || visited[y * width + x]) continue;

      // BFS flood-fill: collect the connected component.
      const queue: { x: number; y: number }[] = [{ x, y }];
      const clusterTiles: { x: number; y: number }[] = [];
      visited[y * width + x] = 1;
      while (queue.length) {
        const pt = queue.shift()!;
        clusterTiles.push(pt);
        for (const [dx, dy] of DIRS) {
          const nx = pt.x + dx, ny = pt.y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (tiles[ny][nx].type !== 'mountain' || visited[ny * width + nx]) continue;
          visited[ny * width + nx] = 1;
          queue.push({ x: nx, y: ny });
        }
      }

      const clusterSet = new Set(clusterTiles.map(t => `${t.x},${t.y}`));

      // BFS inward from edge tiles → interior depth per tile.
      const interiorDepth = new Map<string, number>();
      const iqueue: { x: number; y: number; d: number }[] = [];
      for (const pt of clusterTiles) {
        const isEdge = DIRS.some(([dx, dy]) => {
          const nx = pt.x + dx, ny = pt.y + dy;
          return nx < 0 || ny < 0 || nx >= width || ny >= height
            || tiles[ny][nx].type !== 'mountain';
        });
        if (isEdge) {
          interiorDepth.set(`${pt.x},${pt.y}`, 0);
          iqueue.push({ x: pt.x, y: pt.y, d: 0 });
        }
      }
      while (iqueue.length) {
        const { x: tx, y: ty, d } = iqueue.shift()!;
        for (const [dx, dy] of DIRS) {
          const nx = tx + dx, ny = ty + dy;
          const key = `${nx},${ny}`;
          if (clusterSet.has(key) && !interiorDepth.has(key)) {
            interiorDepth.set(key, d + 1);
            iqueue.push({ x: nx, y: ny, d: d + 1 });
          }
        }
      }

      const maxDepth = clusterTiles.reduce(
        (m, t) => Math.max(m, interiorDepth.get(`${t.x},${t.y}`) ?? 0), 0,
      );
      const size = clusterTiles.length;
      const tier: 0 | 1 | 2 = size >= 25 ? 2 : size >= 9 ? 1 : 0;

      // ── Find main summit: tile with highest elevation, biased toward interior.
      let mainSummit = clusterTiles[0];
      let bestScore  = -Infinity;
      for (const pt of clusterTiles) {
        const elev   = tiles[pt.y][pt.x].elevation;
        const depth  = interiorDepth.get(`${pt.x},${pt.y}`) ?? 0;
        const score  = elev + depth * 0.08;  // slight interior bonus
        if (score > bestScore) { bestScore = score; mainSummit = pt; }
      }

      // ── Find secondary summits: well-interior tiles spaced from each other.
      const maxSecondary = Math.min(4, Math.floor(Math.sqrt(size / 6)));
      const secondarySummits: { x: number; y: number }[] = [];
      const minSpacing = Math.max(4, Math.ceil(Math.sqrt(size) * 0.55));

      const candidates = clusterTiles
        .filter(pt => {
          if (`${pt.x},${pt.y}` === `${mainSummit.x},${mainSummit.y}`) return false;
          const depth = interiorDepth.get(`${pt.x},${pt.y}`) ?? 0;
          if (depth < Math.max(1, maxDepth * 0.35)) return false;
          const dx = pt.x - mainSummit.x, dy = pt.y - mainSummit.y;
          return Math.sqrt(dx * dx + dy * dy) >= minSpacing;
        })
        .sort((a, b) => tiles[b.y][b.x].elevation - tiles[a.y][a.x].elevation);

      for (const pt of candidates) {
        if (secondarySummits.length >= maxSecondary) break;
        const tooClose = secondarySummits.some(s => {
          const dx = s.x - pt.x, dy = s.y - pt.y;
          return Math.sqrt(dx * dx + dy * dy) < minSpacing;
        });
        if (!tooClose) secondarySummits.push(pt);
      }

      clusters.push({ tiles: clusterTiles, interiorDepth, maxDepth, size, tier, mainSummit, secondarySummits });
    }
  }

  return clusters;
}

// ─── Mountain height-field generator (adapted from MountainGenerator.js) ─────

interface MountainGenData {
  width: number;
  height: number;
  heightMap: Float32Array;
  shadeMap: Float32Array;
  seed: number;
  snowLine: number;
  foothillThreshold: number;
}

/** Generates a height map + directional shade map for a mountain cluster.
 *  Uses radial falloff, ridge sinusoids, gullies, and random sub-peaks —
 *  adapted directly from MountainGenerator.js. */
function generateMountainData(
  clusterW: number,
  clusterH: number,
  seed: number,
  tier: 0 | 1 | 2,
): MountainGenData {
  const CELLS = 7;  // sub-grid cells per world tile
  const gridW = Math.max(28, clusterW * CELLS);
  const gridH = Math.max(28, clusterH * CELLS);
  const rng = makeRng(seed);
  const TAU = Math.PI * 2;

  const cx = (gridW - 1) * 0.5;
  const cy = (gridH - 1) * 0.52;
  const radiusX = gridW * 0.44;
  const radiusY = gridH * 0.42;

  // Ridge octave params — more octaves + higher strength → system of ridges
  // instead of a single smooth dome. Lower frequency step keeps ridges broader.
  const ridgeParams: { amp: number; freq: number; phase: number }[] = [];
  for (let i = 0; i < 7; i++) {
    ridgeParams.push({
      amp:   Math.pow(0.58, i) * (0.70 + rng() * 0.50),
      freq:  1.5 + i * 1.2 + (rng() - 0.5) * 0.36,
      phase: rng() * TAU,
    });
  }

  // More sub-peaks scattered across the radius to create a range of summits
  const nPeaks = 3 + Math.floor(rng() * 5);
  const subPeaks: { px: number; py: number; r: number }[] = [];
  for (let i = 0; i < nPeaks; i++) {
    subPeaks.push({
      px: cx + (rng() - 0.5) * 0.85 * radiusX,
      py: cy + (rng() - 0.5) * 0.75 * radiusY,
      r:  0.28 + rng() * 0.42,
    });
  }

  const count = gridW * gridH;
  const raw    = new Float32Array(count);
  const smooth = new Float32Array(count);
  const shades = new Float32Array(count);

  // ── Raw height map
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const dx = (x - cx) / radiusX;
      const dy = (y - cy) / radiusY;
      // Cheap domain warp to avoid concentric ring artefacts
      const wx = 0.095 * Math.sin((x + seed * 0.0001) * 0.21 + y * 0.07);
      const wy = 0.095 * Math.cos((y - seed * 0.00007) * 0.18 - x * 0.08);
      const dxw = dx + wx, dyw = dy + wy;
      const radial = Math.sqrt(dxw * dxw + dyw * dyw);
      if (radial >= 1.3) continue;

      const angle = Math.atan2(dyw, dxw);
      let base = Math.max(0, 1 - radial);
      // Lower power → flatter plateau so ridges can compete with the base.
      base = Math.pow(base, 0.75) * (1 + 0.18 * Math.exp(-radial * 3));

      let ridgeWave = 0, ridgeNorm = 0;
      for (const rp of ridgeParams) {
        ridgeWave += rp.amp * Math.sin(angle * rp.freq + rp.phase + radial * rp.freq * 1.35);
        ridgeNorm += Math.abs(rp.amp);
      }
      if (ridgeNorm > 0) ridgeWave /= ridgeNorm;
      // Higher ridgeStrength (0.65 vs 0.30) → distinct peaks and saddles emerge
      const ridgeProfile = 1 + 0.65 * ridgeWave * Math.pow(Math.max(0, 1 - radial), 0.55);

      const gullyWave = Math.sin(angle * 22 + radial * 15 + seed * 0.0000027);
      const gullyDepth = 0.11 * Math.pow(Math.abs(gullyWave), 2.25) * Math.max(0, 1 - radial);

      let h = base * ridgeProfile - gullyDepth;
      for (const sp of subPeaks) {
        const sdx = (x - sp.px) / radiusX, sdy = (y - sp.py) / radiusY;
        const sr = Math.sqrt(sdx * sdx + sdy * sdy);
        if (sr < 1) h += Math.pow(1 - sr, 2.1) * sp.r * 0.55;
      }
      raw[y * gridW + x] = Math.max(0, Math.min(1, h));
    }
  }

  // ── 3×3 weighted blur (reduces aliasing on the triangle mesh)
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      let total = 0, wsum = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const ny = y + oy; if (ny < 0 || ny >= gridH) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox; if (nx < 0 || nx >= gridW) continue;
          const w = (ox === 0 && oy === 0) ? 2 : 1;
          total += raw[ny * gridW + nx] * w; wsum += w;
        }
      }
      smooth[y * gridW + x] = total / wsum;
    }
  }

  // ── Directional shade: light from upper-left [-0.55, -0.35, 0.76]
  const LX = -0.55, LY = -0.35, LZ = 0.76;
  const ll = Math.sqrt(LX * LX + LY * LY + LZ * LZ);
  const nlx = LX / ll, nly = LY / ll, nlz = LZ / ll;
  for (let y = 0; y < gridH; y++) {
    const ym = y > 0 ? y - 1 : y, yp = y + 1 < gridH ? y + 1 : y;
    for (let x = 0; x < gridW; x++) {
      if (smooth[y * gridW + x] <= 0.025) continue;
      const xm = x > 0 ? x - 1 : x, xp = x + 1 < gridW ? x + 1 : x;
      const dzdx = (smooth[y * gridW + xp] - smooth[y * gridW + xm]) * 0.5;
      const dzdy = (smooth[yp * gridW + x] - smooth[ym * gridW + x]) * 0.5;
      const nx2 = -dzdx * 2.4, ny2 = -dzdy * 2.4, nz2 = 1.0;
      const nlen = Math.sqrt(nx2 * nx2 + ny2 * ny2 + nz2 * nz2);
      shades[y * gridW + x] = Math.max(0, Math.min(1,
        (nx2 / nlen) * nlx + (ny2 / nlen) * nly + (nz2 / nlen) * nlz,
      ));
    }
  }

  // Snow line is lower on bigger mountains (more snow visible)
  const snowLine = tier === 2 ? 0.56 : tier === 1 ? 0.65 : 0.75;
  return { width: gridW, height: gridH, heightMap: smooth, shadeMap: shades, seed, snowLine, foothillThreshold: 0.08 };
}

// ─── Mountain projection renderer (adapted from MountainProjectionRenderer.js) ─

type MtnRGB = [number, number, number];

function mtnMix(a: MtnRGB, b: MtnRGB, t: number): MtnRGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function mtnRgb(c: MtnRGB): number {
  return (Math.max(0, Math.min(255, Math.round(c[0]))) << 16)
       | (Math.max(0, Math.min(255, Math.round(c[1]))) << 8)
       |  Math.max(0, Math.min(255, Math.round(c[2])));
}

function mtnNoise(x: number, y: number, seed: number): number {
  let n = Math.imul(x + 11, 374761393) ^ Math.imul(y + 7, 668265263) ^ (seed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function mtnShadeColor(
  h: number, shade: number, slope: number, noise: number,
  snowLine: number, foothillThreshold: number,
  rockDark: MtnRGB, rockMid: MtnRGB, rockLight: MtnRGB,
  snowLight: MtnRGB, snowShade: MtnRGB, foothill: MtnRGB,
): number {
  const ss = (e0: number, e1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (Math.abs(e1 - e0) || 0.00001)));
    return t * t * (3 - 2 * t);
  };
  let col = mtnMix(rockDark, rockLight, Math.max(0, Math.min(1, 0.16 + shade * 0.86 + h * 0.14)));
  col = mtnMix(col, rockMid, 0.28);
  const snowAmt = Math.max(0, Math.min(1,
    ss(snowLine - 0.06, snowLine + 0.12, h) * (1 - ss(0.52, 0.96, slope)) * (0.74 + shade * 0.26),
  ));
  col = mtnMix(col, shade > 0.42 ? snowLight : snowShade, snowAmt);
  const fbBlend = 1 - ss(foothillThreshold * 0.28, foothillThreshold, h);
  col = mtnMix(col, foothill, fbBlend * 0.82);
  const intensity = Math.max(0.5, Math.min(1.12, 0.74 + h * 0.2 - (1 - shade) * 0.14 + (noise - 0.5) * 0.12));
  return mtnRgb([col[0] * intensity, col[1] * intensity, col[2] * intensity]);
}

/** Projects a MountainGenData height field into an isometric view and draws
 *  depth-sorted triangles onto the provided Graphics object.
 *  anchorX/Y = world-pixel position for the mountain base centre-bottom. */
function renderMountainProjection(
  g: Phaser.GameObjects.Graphics,
  data: MountainGenData,
  anchorX: number, anchorY: number,
  clusterPixW: number,   // cluster width  in world pixels (clusterW  * TILE_SIZE)
  clusterPixH: number,   // cluster height in world pixels (clusterH * TILE_SIZE)
  season: number,
): void {
  const { width, height, heightMap, shadeMap, seed, snowLine, foothillThreshold } = data;
  const gcx = (width - 1) * 0.5, gcy = (height - 1) * 0.5;
  // xScale / yScale derived independently so the base footprint exactly covers
  // the cluster's tile bounding box in screen space.
  const xScale      = clusterPixW / (width + height);
  const yScale      = clusterPixH / (width + height);
  // ~10× less height than before — appropriate for a top-down view
  const heightScale = Math.min(clusterPixW, clusterPixH) * 0.07;

  // Seasonal palette
  const rockDark:  MtnRGB = season === 3 ? [72,78,90]    : [54,52,58];
  const rockMid:   MtnRGB = season === 3 ? [130,108,90]  : [116,90,64];
  const rockLight: MtnRGB = season === 3 ? [180,165,148] : [169,136,92];
  const snowLight: MtnRGB = [243, 245, 238];
  const snowShade: MtnRGB = [198, 207, 219];
  const foothill:  MtnRGB = season === 3 ? [88,108,108]  : [99,128,78];

  // Project every grid vertex into screen-relative space
  type V = { x: number; y: number; depth: number };
  const verts: V[] = new Array(width * height);
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x - gcx, v = y - gcy;
      const h = heightMap[y * width + x];
      const sx = (u - v) * xScale;
      const sy = (u + v) * yScale - h * heightScale;
      const depth = u + v + h * 0.24;
      verts[y * width + x] = { x: sx, y: sy, depth };
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sy > maxY) maxY = sy;
    }
  }

  // Centre horizontally, align bottom to anchorY
  const offX = anchorX - (minX + maxX) * 0.5;
  const offY = anchorY - maxY;

  // Build triangle list with depth and pre-computed colour
  interface Tri {
    ax: number; ay: number; bx: number; by: number; cx: number; cy: number;
    depth: number; color: number;
  }
  const tris: Tri[] = [];

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i00 = y * width + x,       i10 = y * width + (x + 1);
      const i01 = (y + 1) * width + x, i11 = (y + 1) * width + (x + 1);

      const h00 = heightMap[i00], h10 = heightMap[i10];
      const h01 = heightMap[i01], h11 = heightMap[i11];
      if (Math.max(h00, h10, h01, h11) < 0.02) continue;

      const s00 = shadeMap[i00], s10 = shadeMap[i10];
      const s01 = shadeMap[i01], s11 = shadeMap[i11];
      const p00 = verts[i00], p10 = verts[i10];
      const p01 = verts[i01], p11 = verts[i11];

      const slopeA = Math.abs(h10 - h00) * 0.9 + Math.abs(h11 - h10) * 0.7 + Math.abs(h01 - h00) * 0.7;
      const slopeB = Math.abs(h11 - h01) * 0.9 + Math.abs(h11 - h10) * 0.7 + Math.abs(h01 - h00) * 0.7;

      tris.push({
        ax: p00.x + offX, ay: p00.y + offY,
        bx: p10.x + offX, by: p10.y + offY,
        cx: p11.x + offX, cy: p11.y + offY,
        depth: (p00.depth + p10.depth + p11.depth) / 3,
        color: mtnShadeColor((h00+h10+h11)/3, (s00+s10+s11)/3, slopeA,
          mtnNoise(x*2, y*2, seed), snowLine, foothillThreshold,
          rockDark, rockMid, rockLight, snowLight, snowShade, foothill),
      });
      tris.push({
        ax: p00.x + offX, ay: p00.y + offY,
        bx: p11.x + offX, by: p11.y + offY,
        cx: p01.x + offX, cy: p01.y + offY,
        depth: (p00.depth + p11.depth + p01.depth) / 3,
        color: mtnShadeColor((h00+h11+h01)/3, (s00+s11+s01)/3, slopeB,
          mtnNoise(x*2+1, y*2+1, seed), snowLine, foothillThreshold,
          rockDark, rockMid, rockLight, snowLight, snowShade, foothill),
      });
    }
  }

  // Painter's algorithm: back-to-front sort, then draw
  tris.sort((a, b) => a.depth - b.depth);
  for (const tri of tris) {
    g.fillStyle(tri.color, 1);
    g.fillTriangle(tri.ax, tri.ay, tri.bx, tri.by, tri.cx, tri.cy);
  }
}

// ─── Cliff face drawing ───────────────────────────────────────────────────────

/** Draws a stone cliff face on every ocean/coast-facing edge of a mountain tile.
 *  Includes horizontal strata lines and wave foam at the cliff base. */
function drawCliffFace(
  g: Phaser.GameObjects.Graphics,
  tx: number, ty: number,
  tiles: Tile[][],
  width: number, height: number,
  season: number,
  rng: () => number,
): void {
  const TS = TILE_SIZE;
  const DIRS: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  for (const [dx, dy] of DIRS) {
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const n = tiles[ny][nx];
    if (n.type !== 'ocean' && n.type !== 'coast') continue;

    const cliffH  = 48 + rng() * 38;
    const halfEdge = TS * 0.50;
    // Edge midpoint (boundary between the two tiles)
    const ex = (tx + 0.5 + dx * 0.5) * TS;
    const ey = (ty + 0.5 + dy * 0.5) * TS;
    // Along-edge axis (perpendicular to the cliff's outward normal)
    const ax = Math.abs(dy);  // 1 for N/S edges, 0 for E/W
    const ay = Math.abs(dx);

    // Top of cliff face = the edge between the mountain and water tiles
    const topL = { x: ex - ax * halfEdge, y: ey - ay * halfEdge };
    const topR = { x: ex + ax * halfEdge, y: ey + ay * halfEdge };
    // Bottom: drops toward viewer (+y screen) and slightly toward the ocean
    const dropY = cliffH * 0.82;
    const dropX = dx * cliffH * 0.22;
    const botL = { x: topL.x + dropX, y: topL.y + dropY };
    const botR = { x: topR.x + dropX, y: topR.y + dropY };

    // Drop shadow
    g.fillStyle(0x000000, 0.16);
    g.fillPoints([
      { x: topL.x + 4, y: topL.y + 5 },
      { x: topR.x + 4, y: topR.y + 5 },
      { x: botR.x + 4, y: botR.y + 5 },
      { x: botL.x + 4, y: botL.y + 5 },
    ], true);

    // Main cliff face
    const stoneColor = season === 3 ? 0x8898a8 : 0x7a6e5c;
    g.fillStyle(stoneColor, 0.90);
    g.fillPoints([topL, topR, botR, botL], true);

    // Lit left third
    const t1 = 0.36;
    const midTL = { x: topL.x + (topR.x - topL.x) * t1, y: topL.y + (topR.y - topL.y) * t1 };
    const midBL = { x: botL.x + (botR.x - botL.x) * t1, y: botL.y + (botR.y - botL.y) * t1 };
    const stoneLit = season === 3 ? 0xa8b8c8 : 0xa09080;
    g.fillStyle(stoneLit, 0.26);
    g.fillPoints([topL, midTL, midBL, botL], true);

    // Shadow right third
    const t2 = 0.66;
    const midTR = { x: topL.x + (topR.x - topL.x) * t2, y: topL.y + (topR.y - topL.y) * t2 };
    const midBR = { x: botL.x + (botR.x - botL.x) * t2, y: botL.y + (botR.y - botL.y) * t2 };
    g.fillStyle(0x000000, 0.18);
    g.fillPoints([midTR, topR, botR, midBR], true);

    // Horizontal strata lines (geological layers)
    const strataCount = 3 + Math.floor(rng() * 4);
    for (let s = 0; s < strataCount; s++) {
      const t = (s + 0.5 + (rng() - 0.5) * 0.28) / strataCount;
      const sl = { x: topL.x + (botL.x - topL.x) * t, y: topL.y + (botL.y - topL.y) * t };
      const sr = { x: topR.x + (botR.x - topR.x) * t, y: topR.y + (botR.y - topR.y) * t };
      const strataCol = rng() < 0.4 ? 0x504840 : 0x908070;
      g.lineStyle(0.7 + rng() * 0.9, strataCol, 0.40 + rng() * 0.22);
      g.lineBetween(sl.x, sl.y, sr.x, sr.y);
    }

    // Silhouette outline
    g.lineStyle(1.0, 0x282018, 0.58);
    g.strokePoints([topL, topR, botR, botL], true);

    // Wave foam at cliff base
    const foamCount = 2 + Math.floor(rng() * 4);
    for (let f = 0; f < foamCount; f++) {
      const t = rng();
      const fx = botL.x + (botR.x - botL.x) * t;
      const fy = botL.y + (botR.y - botL.y) * t + 2 + rng() * 8;
      const fr = 10 + rng() * 18;
      g.fillStyle(0xf0f4fc, 0.54 - rng() * 0.20);
      g.fillEllipse(fx, fy, fr * 2.4, fr * 0.50);
    }
  }
}
