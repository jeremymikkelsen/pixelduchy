import { useGameStore } from '../../store/gameStore';

/**
 * GameHUD - top bar showing key duchy stats, favor, and turn controls.
 */
export function GameHUD() {
  const { session, myDuchy, endTurn } = useGameStore();

  if (!session || !myDuchy) return null;

  const { resources, population, kingsFavor } = myDuchy;
  const hasPendingDemand = session.currentKingDemand !== null;
  const hasPendingOffer  = session.kingsTileOffer !== null;
  const isBlocked = hasPendingDemand || hasPendingOffer;
  const favorPct = Math.max(0, Math.min(100, kingsFavor));
  const favorColor = favorPct < 25 ? '#e05050' : favorPct < 50 ? '#e0a030' : '#c9a227';

  let endTurnLabel = 'End Turn →';
  if (hasPendingDemand) endTurnLabel = '⚠ King Demands…';
  else if (hasPendingOffer) endTurnLabel = '👑 King Offers…';

  return (
    <div className="hud-bar">
      <div className="hud-duchy-name">
        <span
          className="duchy-color-dot"
          style={{ background: myDuchy.color }}
          title="Your duchy color"
        />
        {myDuchy.name}
      </div>

      <div className="hud-resources">
        <span title="Grain">🌾 {resources.grain}</span>
        <span title="Timber">🪵 {resources.timber}</span>
        <span title="Ore">⛏️ {resources.ore}</span>
        <span title="Cloth">🧵 {resources.cloth}</span>
        <span title="Fish">🐟 {resources.fish}</span>
        <span title="Gold">💰 {resources.gold}</span>
        <span title="Population">👥 {population.total}</span>
      </div>

      <div className="hud-favor" title={`King's Favor: ${kingsFavor}/100`}>
        <span className="favor-label">♟ Favor</span>
        <div className="favor-bar">
          <div className="favor-fill" style={{ width: `${favorPct}%`, background: favorColor }} />
        </div>
        <span className="favor-number">{kingsFavor}</span>
      </div>

      <div className="hud-turn">Turn {session.turnNumber} / {session.maxTurns}</div>

      <button
        className={`btn-end-turn ${isBlocked ? 'btn-end-turn--blocked' : ''}`}
        onClick={endTurn}
        disabled={isBlocked}
        title={
          hasPendingDemand ? "Respond to the King's demand first"
          : hasPendingOffer ? "Respond to the King's offer first"
          : 'End your turn and collect resources'
        }
      >
        {endTurnLabel}
      </button>
    </div>
  );
}
