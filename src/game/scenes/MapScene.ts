import Phaser from 'phaser';
import { generateWorld } from '../procgen/worldgen';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { BUILDING_LABELS } from '../systems/turnEngine';
import { TILE_SIZE, NUM_TILE_VARIANTS, getSeasonIndex } from '../procgen/tileRenderer';
import type { WorldMap, Tile, Duchy, TileType } from '../../types';

/**
 * MapScene - renders the game world tilemap and handles camera/input.
 */
export class MapScene extends Phaser.Scene {
  private world!: WorldMap;
  private tileGroup!: Phaser.GameObjects.Group;
  private territoryOverlay!: Phaser.GameObjects.Graphics;
  private riverGraphics!: Phaser.GameObjects.Graphics;
  private buildingLabels: Phaser.GameObjects.Text[] = [];
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
    this.world = existingSession?.map ?? generateWorld({ width: 64, height: 64, seed: Date.now() });
    this.currentSeasonIndex = getSeasonIndex(existingSession?.turnNumber ?? 1);

    this.tileGroup = this.add.group();
    // Rivers sit above terrain (depth 0) but below territory overlay (depth 1)
    this.riverGraphics = this.add.graphics().setDepth(0.5);
    this.territoryOverlay = this.add.graphics().setDepth(1);

    this.renderMap();
    this.renderRivers();
    this.setupCamera();
    this.setupInput();

    this.scene.launch('UIScene');

    this.unsubscribeStore = useGameStore.subscribe((state) => {
      const newMap = state.session?.map;
      if (newMap && newMap !== this.world) {
        this.world = newMap;
        this.tileGroup.clear(true, true);
        this.renderMap();
        this.renderRivers();
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
      }

      this.renderOverlays(state.myDuchy);
    });

    this.renderOverlays(useGameStore.getState().myDuchy);
  }

  shutdown() {
    this.unsubscribeStore?.();
    this.buildingLabels = [];
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

        img.on('pointerup', () => {
          if (this.dragMoved) return;
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

  // ─── River rendering ─────────────────────────────────────────────────────────

  private renderRivers() {
    this.riverGraphics.clear();
    const rivers = this.world.rivers ?? [];

    for (const river of rivers) {
      if (river.length < 2) continue;

      const raw = river.map(p => ({
        x: p.x * TILE_SIZE + TILE_SIZE / 2,
        y: p.y * TILE_SIZE + TILE_SIZE / 2,
      }));

      const smooth = catmullRom(raw, 5);
      if (smooth.length < 2) continue;

      // Three-pass draw: outer glow → main body → bright highlight
      const passes: [number, number, number][] = [
        [5.5, 0x2060b0, 0.22],
        [2.5, 0x3a88e0, 0.72],
        [1.0, 0x90c8f8, 0.48],
      ];
      for (const [width, color, alpha] of passes) {
        this.riverGraphics.lineStyle(width, color, alpha);
        this.riverGraphics.beginPath();
        this.riverGraphics.moveTo(smooth[0].x, smooth[0].y);
        for (let i = 1; i < smooth.length; i++) {
          this.riverGraphics.lineTo(smooth[i].x, smooth[i].y);
        }
        this.riverGraphics.strokePath();
      }
    }
  }

  // ─── Territory + building overlays ───────────────────────────────────────────

  private renderOverlays(duchy: Duchy | null) {
    this.territoryOverlay.clear();
    this.buildingLabels.forEach(l => l.destroy());
    this.buildingLabels = [];
    if (!duchy) return;

    const ownedSet = new Set(duchy.tiles.map(({ x, y }) => `${x},${y}`));

    this.territoryOverlay.fillStyle(0xff2020, 0.12);
    for (const { x, y } of duchy.tiles) {
      this.territoryOverlay.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    this.territoryOverlay.lineStyle(3, 0xff2020, 1.0);
    for (const { x, y } of duchy.tiles) {
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      if (!ownedSet.has(`${x},${y - 1}`)) this.territoryOverlay.lineBetween(px, py, px + TILE_SIZE, py);
      if (!ownedSet.has(`${x},${y + 1}`)) this.territoryOverlay.lineBetween(px, py + TILE_SIZE, px + TILE_SIZE, py + TILE_SIZE);
      if (!ownedSet.has(`${x - 1},${y}`)) this.territoryOverlay.lineBetween(px, py, px, py + TILE_SIZE);
      if (!ownedSet.has(`${x + 1},${y}`)) this.territoryOverlay.lineBetween(px + TILE_SIZE, py, px + TILE_SIZE, py + TILE_SIZE);
    }

    for (const building of duchy.buildings) {
      const label = this.add.text(
        building.tileX * TILE_SIZE + TILE_SIZE / 2,
        building.tileY * TILE_SIZE + TILE_SIZE / 2,
        BUILDING_LABELS[building.type],
        { fontSize: '10px', color: '#ffffff', backgroundColor: '#000000bb', padding: { x: 2, y: 1 } },
      ).setOrigin(0.5).setDepth(2);
      this.buildingLabels.push(label);
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
