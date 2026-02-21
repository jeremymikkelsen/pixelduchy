import { useGameStore } from '../../store/gameStore';

/**
 * KingDemandModal - blocks the UI when the King issues a demand.
 * Player must fulfill or refuse before ending their next turn.
 */
export function KingDemandModal() {
  const { session, myDuchy, fulfillDemand, refuseDemand } = useGameStore();
  const demand = session?.currentKingDemand;

  if (!demand || !myDuchy) return null;

  const playerHas = myDuchy.resources[demand.resourceType] ?? 0;
  const canAffordIt = playerHas >= demand.amount;

  return (
    <div className="modal-backdrop">
      <div className="modal-box demand-modal">
        <div className="demand-seal">👑</div>
        <h2 className="demand-title">Royal Decree</h2>
        <p className="demand-body">
          His Majesty demands{' '}
          <strong>{demand.amount} {demand.resourceType}</strong>{' '}
          from your duchy before the next turn.
        </p>
        <div className="demand-outcome-row">
          <span className="demand-reward">✔ Fulfill: +{demand.favorReward} favor</span>
          <span className="demand-penalty">✘ Refuse: −{demand.favorPenalty} favor</span>
        </div>
        {!canAffordIt && (
          <p className="demand-warning">
            ⚠ You only have {playerHas} {demand.resourceType} — you cannot fulfill this demand.
          </p>
        )}
        <div className="demand-actions">
          <button
            className="btn-primary"
            onClick={fulfillDemand}
            disabled={!canAffordIt}
          >
            Fulfill ({demand.amount} {demand.resourceType})
          </button>
          <button className="btn-secondary" onClick={refuseDemand}>
            Refuse (−{demand.favorPenalty} favor)
          </button>
        </div>
      </div>
    </div>
  );
}
