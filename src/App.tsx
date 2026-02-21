import { useState } from 'react';
import { usePhaser } from './hooks/usePhaser';
import { useGameStore } from './store/gameStore';
import { MainMenu } from './components/menus/MainMenu';
import { GameHUD } from './components/hud/GameHUD';
import { TilePanel } from './components/panels/TilePanel';
import { createGame } from './lib/supabase/queries';
import './App.css';

export default function App() {
  const [inGame, setInGame] = useState(false);
  const { setSession } = useGameStore();

  // Initialize Phaser once we're in-game
  usePhaser();

  async function handleCreateGame() {
    try {
      const newSession = await createGame('local-dev');
      setSession(newSession);
      setInGame(true);
    } catch {
      // No Supabase configured yet — run locally
      setInGame(true);
    }
  }

  function handleJoinGame(_gameId: string) {
    // TODO: fetch session and join
    setInGame(true);
  }

  return (
    <div id="app">
      {/* Phaser canvas sits beneath all React UI */}
      <div id="phaser-container" />

      {!inGame ? (
        <MainMenu onCreateGame={handleCreateGame} onJoinGame={handleJoinGame} />
      ) : (
        <>
          <GameHUD />
          <TilePanel />
        </>
      )}
    </div>
  );
}
