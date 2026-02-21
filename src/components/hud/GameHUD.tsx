import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';

/**
 * GameHUD - top bar showing key duchy stats and turn info.
 */
export function GameHUD() {
  const { session, myDuchy } = useGameStore();
  const { setOpenPanel } = useUIStore();

  if (!session || !myDuchy) return null;

  const { resources, population, kingsFavor } = myDuchy;

  return (
    <div className="hud-bar">
      <div className="hud-duchy-name">{myDuchy.name}</div>

      <div className="hud-resources">
        <span title="Grain">🌾 {resources.grain}</span>
        <span title="Timber">🪵 {resources.timber}</span>
        <span title="Ore">⛏️ {resources.ore}</span>
        <span title="Gold">💰 {resources.gold}</span>
        <span title="Population">👥 {population.total}</span>
      </div>

      <div className="hud-favor" title="King's Favor">
        ♟ Favor: {kingsFavor}
      </div>

      <div className="hud-turn">
        Turn {session.turnNumber} / {session.maxTurns}
      </div>

      <div className="hud-panels">
        <button onClick={() => setOpenPanel('economy')}>Economy</button>
        <button onClick={() => setOpenPanel('intel')}>Intel</button>
        <button onClick={() => setOpenPanel('military')}>Military</button>
        <button onClick={() => setOpenPanel('king')}>King</button>
      </div>
    </div>
  );
}
