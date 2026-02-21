import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { phaserConfig } from '../game/config';

/**
 * Initializes and destroys the Phaser game instance tied to a container div.
 */
export function usePhaser() {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    gameRef.current = new Phaser.Game(phaserConfig);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return gameRef;
}
