import Phaser from 'phaser';

/**
 * UIScene - runs parallel to MapScene.
 * Minimal Phaser UI layer; most UI is handled by React overlays.
 * Used for tooltips and canvas-bound indicators that need Phaser coordinates.
 */
export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
  }

  create() {
    // Future: minimap, tile hover highlight, selection indicator
  }
}
