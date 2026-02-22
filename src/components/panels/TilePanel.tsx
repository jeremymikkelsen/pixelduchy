import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { BUILDING_COSTS, BUILDING_DESCRIPTIONS, canAfford } from '../../game/systems/turnEngine';
import type { BuildingType } from '../../types';

const BUILDABLE: BuildingType[] = ['house', 'mill', 'mine', 'sawmill', 'port', 'barracks', 'market', 'church', 'castle'];

/**
 * TilePanel - shows tile info and a build menu when clicking an owned tile.
 */
export function TilePanel() {
  const { session, myDuchy, placeBuilding } = useGameStore();
  const { selectedTile, setSelectedTile } = useUIStore();

  if (!selectedTile || !session) return null;

  const { x, y } = selectedTile;
  const tile = session.map.tiles[y]?.[x];
  if (!tile) return null;

  const isOwned = myDuchy?.tiles.some(t => t.x === x && t.y === y) ?? false;
  const existingBuilding = myDuchy?.buildings.find(b => b.tileX === x && b.tileY === y);
  const resources = myDuchy?.resources;

  return (
    <div className="panel tile-panel">
      <button className="panel-close" onClick={() => setSelectedTile(null)}>✕</button>

      <h3>{tile.type.charAt(0).toUpperCase() + tile.type.slice(1)} ({x}, {y})</h3>
      <p>Elevation: {tile.elevation.toFixed(2)}</p>
      {tile.resource && (
        <p>Resource: <strong>{tile.resource}</strong> ({tile.resourceYield}/turn)</p>
      )}

      {isOwned ? (
        <div className="build-section">
          {existingBuilding ? (
            <p className="building-existing">
              🏗 <strong>{existingBuilding.type}</strong> (Lv {existingBuilding.level})
              <br />
              <span className="building-desc">{BUILDING_DESCRIPTIONS[existingBuilding.type]}</span>
            </p>
          ) : (
            <>
              <p className="build-header">Construct building:</p>
              <div className="build-list">
                {BUILDABLE.map((type) => {
                  const cost = BUILDING_COSTS[type];
                  const affordable = resources ? canAfford(resources, cost) : false;
                  const costStr = Object.entries(cost).map(([r, n]) => `${n} ${r}`).join(', ');
                  return (
                    <button
                      key={type}
                      className={`build-btn ${affordable ? '' : 'build-btn--unaffordable'}`}
                      onClick={() => placeBuilding(type, x, y)}
                      disabled={!affordable}
                      title={BUILDING_DESCRIPTIONS[type]}
                    >
                      <span className="build-name">{type}</span>
                      <span className="build-desc">{BUILDING_DESCRIPTIONS[type]}</span>
                      <span className="build-cost">{costStr}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="tile-unowned">
          {tile.duchyId ? `Controlled by: ${tile.duchyId}` : 'Unclaimed territory'}
        </p>
      )}
    </div>
  );
}
