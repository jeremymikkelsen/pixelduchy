import { usePhaser } from './hooks/usePhaser';
import { useGameStore } from './store/gameStore';
import { MainMenu } from './components/menus/MainMenu';
import { GameHUD } from './components/hud/GameHUD';
import { TilePanel } from './components/panels/TilePanel';
import { KingDemandModal } from './components/panels/KingDemandModal';
import { KingTileOfferModal } from './components/panels/KingTileOfferModal';
import { GameResultOverlay } from './components/overlays/GameResultOverlay';
import './App.css';

export default function App() {
  const { session, initLocalGame } = useGameStore();

  // Phaser runs at all times (map visible behind the main menu)
  usePhaser();

  const inGame = session !== null;

  return (
    <div id="app">
      {/* Phaser canvas sits beneath all React UI */}
      <div id="phaser-container" />

      {!inGame ? (
        <MainMenu
          onCreateGame={initLocalGame}
          onJoinGame={initLocalGame}
        />
      ) : (
        <>
          <GameHUD />
          <TilePanel />
          <KingDemandModal />
          <KingTileOfferModal />
          <GameResultOverlay />
        </>
      )}
    </div>
  );
}
