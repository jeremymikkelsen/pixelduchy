import Phaser from 'phaser';

/**
 * BootScene - loads all assets before the game starts.
 * Runs once on launch, then hands off to MapScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Placeholder tiles (will be replaced by real sprites)
    // Using colored rectangles for now so we can run without art assets.
    this.load.on('complete', () => {
      this.createPlaceholderTextures();
    });
  }

  create() {
    this.createPlaceholderTextures();
    this.scene.start('MapScene');
  }

  private createPlaceholderTextures() {
    const tileColors: Record<string, number> = {
      ocean: 0x1a6fa8,
      coast: 0x5ba3c9,
      plains: 0x7db854,
      forest: 0x2d6a1f,
      mountain: 0x8a7a6a,
      wetland: 0x4a7a5a,
      desert: 0xd4b483,
    };

    const tileSize = 32;

    for (const [name, color] of Object.entries(tileColors)) {
      if (!this.textures.exists(name)) {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(color);
        graphics.fillRect(0, 0, tileSize, tileSize);
        graphics.lineStyle(1, 0x000000, 0.2);
        graphics.strokeRect(0, 0, tileSize, tileSize);
        graphics.generateTexture(name, tileSize, tileSize);
        graphics.destroy();
      }
    }
  }
}
