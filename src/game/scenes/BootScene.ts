import Phaser from 'phaser';
import { generateTileVariants, TILE_SIZE } from '../procgen/tileRenderer';
import type { TileType } from '../../types';

/**
 * BootScene - generates all procedural tile textures before the game starts.
 * Runs once on launch, then hands off to MapScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {}

  create() {
    const variants = generateTileVariants(TILE_SIZE);
    for (const [type, canvases] of variants as Map<TileType, HTMLCanvasElement[]>) {
      for (let v = 0; v < canvases.length; v++) {
        const key = `${type}-v${v}`;
        if (!this.textures.exists(key)) {
          this.textures.addCanvas(key, canvases[v]);
        }
      }
    }
    this.scene.start('MapScene');
  }
}
