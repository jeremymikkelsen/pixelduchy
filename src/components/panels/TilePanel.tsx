import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';

/**
 * TilePanel - shows info about the currently selected tile.
 */
export function TilePanel() {
  const { session } = useGameStore();
  const { selectedTile, setSelectedTile } = useUIStore();

  if (!selectedTile || !session) return null;

  const { x, y } = selectedTile;
  const tile = session.map.tiles[y]?.[x];

  if (!tile) return null;

  return (
    <div className="panel tile-panel">
      <button className="panel-close" onClick={() => setSelectedTile(null)}>✕</button>
      <h3>
        {tile.type.charAt(0).toUpperCase() + tile.type.slice(1)} ({x}, {y})
      </h3>
      <p>Elevation: {tile.elevation.toFixed(2)}</p>
      {tile.resource && (
        <p>
          Resource: <strong>{tile.resource}</strong> (yield {tile.resourceYield}/turn)
        </p>
      )}
      {tile.duchyId ? (
        <p>Controlled by duchy: {tile.duchyId}</p>
      ) : (
        <p>Unclaimed territory</p>
      )}
    </div>
  );
}
