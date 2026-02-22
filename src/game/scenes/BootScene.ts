import Phaser from 'phaser';
import { generateAllSeasonVariants, TILE_SIZE } from '../procgen/tileRenderer';
import { generateBuildingTextures } from '../procgen/buildingRenderer';

/**
 * BootScene - generates all procedural tile textures (all 4 seasons × all biomes × 8 variants)
 * before the game starts, then hands off to MapScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {}

  create() {
    const allTextures = generateAllSeasonVariants(TILE_SIZE);
    for (const [key, canvas] of allTextures) {
      if (!this.textures.exists(key)) {
        this.textures.addCanvas(key, canvas);
      }
    }
    const buildingTextures = generateBuildingTextures(TILE_SIZE);
    for (const [key, canvas] of buildingTextures) {
      if (!this.textures.exists(key)) {
        this.textures.addCanvas(key, canvas);
      }
    }

    this.scene.start('MapScene');
  }
}
