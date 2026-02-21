import Phaser from 'phaser';
import { generateWorld } from '../procgen/worldgen';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { BUILDING_LABELS } from '../systems/turnEngine';
import type { WorldMap, Tile, Duchy } from '../../types';

const TILE_SIZE = 32;

/**
 * MapScene - renders the game world tilemap and handles camera/input.
 */
export class MapScene extends Phaser.Scene {
  private world!: WorldMap;
  private tileGroup!: Phaser.GameObjects.Group;
  private territoryOverlay!: Phaser.GameObjects.Graphics;
  private buildingLabels: Phaser.GameObjects.Text[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragScreenStartX = 0;
  private dragScreenStartY = 0;
  private unsubscribeStore?: () => void;

  constructor() {
    super({ key: 'MapScene' });
  }

  create() {
    // If a game session already exists in the store, use its map.
    // Otherwise generate a preview world shown behind the main menu.
    const existingSession = useGameStore.getState().session;
    this.world = existingSession?.map ?? generateWorld({ width: 64, height: 64, seed: Date.now() });

    this.tileGroup = this.add.group();
    this.territoryOverlay = this.add.graphics().setDepth(1);

    this.renderMap();
    this.setupCamera();
    this.setupInput();

    // Launch UI scene on top
    this.scene.launch('UIScene');

    // Subscribe to store — re-render map when session changes, overlays when duchy changes
    this.unsubscribeStore = useGameStore.subscribe((state) => {
      const newMap = state.session?.map;
      if (newMap && newMap !== this.world) {
        this.world = newMap;
        this.tileGroup.clear(true, true);
        this.renderMap();
        // Scroll to show the player's territory
        if (state.myDuchy?.tiles.length) {
          const ts = state.myDuchy.tiles;
          const cx = ts.reduce((s, t) => s + t.x, 0) / ts.length;
          const cy = ts.reduce((s, t) => s + t.y, 0) / ts.length;
          this.cameras.main.centerOn(cx * TILE_SIZE + TILE_SIZE / 2, cy * TILE_SIZE + TILE_SIZE / 2);
        }
      }
      this.renderOverlays(state.myDuchy);
    });

    this.renderOverlays(useGameStore.getState().myDuchy);
  }

  shutdown() {
    this.unsubscribeStore?.();
    this.buildingLabels = [];
  }

  private renderMap() {
    const { tiles, width, height } = this.world;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile: Tile = tiles[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        const img = this.add
          .image(px, py, tile.type)
          .setOrigin(0, 0)
          .setInteractive();

        img.on('pointerup', () => {
          if (this.dragMoved) return;
          useUIStore.getState().setSelectedTile({ x, y });
        });

        this.tileGroup.add(img);
      }
    }
  }

  private renderOverlays(duchy: Duchy | null) {
    this.territoryOverlay.clear();
    this.buildingLabels.forEach(l => l.destroy());
    this.buildingLabels = [];
    if (!duchy) return;

    const ownedSet = new Set(duchy.tiles.map(({ x, y }) => `${x},${y}`));

    // Subtle red tint on owned tiles
    this.territoryOverlay.fillStyle(0xff2020, 0.12);
    for (const { x, y } of duchy.tiles) {
      this.territoryOverlay.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    // Bright red border drawn only on exposed outer edges of the territory
    this.territoryOverlay.lineStyle(3, 0xff2020, 1.0);
    for (const { x, y } of duchy.tiles) {
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      if (!ownedSet.has(`${x},${y - 1}`))
        this.territoryOverlay.lineBetween(px, py, px + TILE_SIZE, py);
      if (!ownedSet.has(`${x},${y + 1}`))
        this.territoryOverlay.lineBetween(px, py + TILE_SIZE, px + TILE_SIZE, py + TILE_SIZE);
      if (!ownedSet.has(`${x - 1},${y}`))
        this.territoryOverlay.lineBetween(px, py, px, py + TILE_SIZE);
      if (!ownedSet.has(`${x + 1},${y}`))
        this.territoryOverlay.lineBetween(px + TILE_SIZE, py, px + TILE_SIZE, py + TILE_SIZE);
    }

    // Building labels
    for (const building of duchy.buildings) {
      const label = this.add.text(
        building.tileX * TILE_SIZE + TILE_SIZE / 2,
        building.tileY * TILE_SIZE + TILE_SIZE / 2,
        BUILDING_LABELS[building.type],
        { fontSize: '8px', color: '#ffffff', backgroundColor: '#000000bb', padding: { x: 2, y: 1 } },
      ).setOrigin(0.5).setDepth(2);
      this.buildingLabels.push(label);
    }
  }

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

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('wheel', (_p: any, _gos: any, _dx: any, dy: number) => {
      const zoom = this.cameras.main.zoom;
      const newZoom = Phaser.Math.Clamp(zoom - dy * 0.001, 0.3, 3);
      this.cameras.main.setZoom(newZoom);
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
