import { useGameStore } from '../../store/gameStore';

/**
 * KingTileOfferModal - shown when the king grants the player a free adjacent tile.
 * Player must accept or decline before ending their turn.
 */
export function KingTileOfferModal() {
  const { session, acceptTileOffer, declineTileOffer } = useGameStore();
  const offer = session?.kingsTileOffer;

  if (!offer) return null;

  const tile = session?.map.tiles[offer.y]?.[offer.x];
  const tileType = tile?.type ?? 'land';
  const hasResource = tile?.resource;

  return (
    <div className="modal-backdrop">
      <div className="modal-box offer-modal">
        <div className="offer-seal">👑</div>
        <h2 className="offer-title">Royal Land Grant</h2>
        <p className="offer-body">
          His Majesty offers to grant your duchy the{' '}
          <strong>{tileType}</strong> tile at ({offer.x}, {offer.y}).
          {hasResource && (
            <> It contains <strong>{tile!.resource}</strong>.</>
          )}
        </p>
        <p className="offer-sub">Will you accept this expansion of your domain?</p>
        <div className="demand-actions">
          <button className="btn-primary" onClick={acceptTileOffer}>
            Accept Grant
          </button>
          <button className="btn-secondary" onClick={declineTileOffer}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
