import Phaser from 'phaser';
import { generateWorld } from '../procgen/worldgen';
import { useUIStore } from '../../store/uiStore';
import type { WorldMap, Tile } from '../../types';

const TILE_SIZE = 32;

/**
 * MapScene - renders the game world tilemap and handles camera/input.
 */
export class MapScene extends Phaser.Scene {
  private world!: WorldMap;
  private tileGroup!: Phaser.GameObjects.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  constructor() {
    super({ key: 'MapScene' });
  }

  create() {
    this.world = generateWorld({ width: 64, height: 64, seed: Date.now() });
    this.tileGroup = this.add.group();

    this.renderMap();
    this.setupCamera();
    this.setupInput();

    // Launch UI scene on top
    this.scene.launch('UIScene');
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
          useUIStore.getState().setSelectedTile({ x, y });
        });

        this.tileGroup.add(img);
      }
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

    // Drag to pan
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartX = p.x + this.cameras.main.scrollX;
      this.dragStartY = p.y + this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      this.cameras.main.scrollX = this.dragStartX - p.x;
      this.cameras.main.scrollY = this.dragStartY - p.y;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // Scroll to zoom
    this.input.on('wheel', (_p: any, _gos: any, _dx: any, dy: number) => {
      const zoom = this.cameras.main.zoom;
      const newZoom = Phaser.Math.Clamp(zoom - dy * 0.001, 0.3, 3);
      this.cameras.main.setZoom(newZoom);
    });
  }

  update() {
    const speed = 8 / this.cameras.main.zoom;
    if (this.cursors.left.isDown) this.cameras.main.scrollX -= speed;
    if (this.cursors.right.isDown) this.cameras.main.scrollX += speed;
    if (this.cursors.up.isDown) this.cameras.main.scrollY -= speed;
    if (this.cursors.down.isDown) this.cameras.main.scrollY += speed;
  }
}
