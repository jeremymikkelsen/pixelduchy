import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import {
  ALL_BUILDING_TYPES,
  BUILDING_DEFS,
  canPlaceOnTerrain,
  canAffordBuilding,
  formatCost,
  formatYields,
  type BuildingDef,
} from '../../state/Building';
/** Check if a region is on a river path */
function regionHasRiver(regionIdx: number, hydro: { rivers: number[][] }): boolean {
  for (const path of hydro.rivers) {
    if (path.includes(regionIdx)) return true;
  }
  return false;
}

/** Check if a region is forested (same logic as DuchyGenerator) */
function regionHasForest(
  regionIdx: number,
  terrainType: string,
  moisture: number,
): boolean {
  if (terrainType === 'highland') return true;
  if (terrainType === 'lowland' && moisture > 0.5) return true;
  return false;
}

type BuildStatus = 'available' | 'unaffordable' | 'unavailable';

function getBuildStatus(
  def: BuildingDef,
  terrain: string,
  hasRiver: boolean,
  hasForest: boolean,
  resources: Record<string, number>,
): BuildStatus {
  if (!canPlaceOnTerrain(def, terrain, hasRiver, hasForest)) return 'unavailable';
  if (!canAffordBuilding(def, resources)) return 'unaffordable';
  return 'available';
}

const STATUS_COLORS: Record<BuildStatus, string> = {
  available: '#2d6a2d',
  unaffordable: '#8b2020',
  unavailable: '#444',
};

const STATUS_TEXT_COLORS: Record<BuildStatus, string> = {
  available: '#8fdf8f',
  unaffordable: '#e88',
  unavailable: '#777',
};

function BuildOption({ def, status }: { def: BuildingDef; status: BuildStatus }) {
  return (
    <div
      className="rp-build-option"
      style={{
        background: STATUS_COLORS[status],
        color: STATUS_TEXT_COLORS[status],
        opacity: status === 'unavailable' ? 0.5 : 1,
      }}
    >
      <span className="rp-build-icon">{def.icon}</span>
      <div className="rp-build-info">
        <span className="rp-build-name">{def.label}</span>
        <span className="rp-build-cost">{formatCost(def.cost)}</span>
      </div>
      {def.yields.length > 0 && (
        <span className="rp-build-yields">{formatYields(def.yields)}</span>
      )}
    </div>
  );
}

export function RegionPanel() {
  const selectedRegion = useUIStore(s => s.selectedRegion);
  const setSelectedRegion = useUIStore(s => s.setSelectedRegion);
  const { gameState, playerDuchy, playerEconomy } = useGameStore();

  if (selectedRegion === null || selectedRegion < 0 || !gameState) return null;

  const terrain = gameState.topo.terrainType[selectedRegion];
  const elevation = gameState.topo.elevation[selectedRegion];
  const moisture = gameState.hydro.moisture[selectedRegion];
  const duchyIdx = gameState.regionToDuchy[selectedRegion];

  const duchy = duchyIdx >= 0 ? gameState.duchies[duchyIdx] : null;
  const house = duchy?.house;
  const colorHex = house ? '#' + house.color.toString(16).padStart(6, '0') : undefined;
  const isCapital = duchy ? selectedRegion === duchy.capitalRegion : false;
  const isPlayerRegion = playerDuchy != null && duchyIdx === gameState.playerDuchy;

  // Check for existing buildings/improvements on this region
  let buildingName: string | null = null;
  let buildingIcon: string | null = null;

  // Woodcutters / Sawmills
  for (const wc of gameState.woodcutters.values()) {
    if (wc.regionIndex === selectedRegion) {
      buildingIcon = wc.variant === 'sawmill' ? '🪚' : '🪓';
      buildingName = wc.variant === 'sawmill' ? 'Sawmill' : 'Woodcutter';
      break;
    }
  }
  // Fishing camps
  if (!buildingName) {
    for (const fc of gameState.fishingCamps.values()) {
      if (fc.regionIndex === selectedRegion) {
        buildingIcon = '🐟';
        buildingName = fc.variant === 'ocean' ? 'Fishing Pier' : 'River Wharf';
        break;
      }
    }
  }
  // Mines
  if (!buildingName) {
    for (const mine of gameState.mines.values()) {
      if (mine.regionIndex === selectedRegion) {
        buildingIcon = '⛏️';
        buildingName = 'Mine';
        break;
      }
    }
  }
  // Smelters
  if (!buildingName) {
    for (const smelter of gameState.smelters.values()) {
      if (smelter.regionIndex === selectedRegion) {
        buildingIcon = '🔥';
        buildingName = 'Smelter';
        break;
      }
    }
  }
  // Agricultural improvements
  if (!buildingName) {
    const agType = gameState.agImprovements.get(selectedRegion);
    if (agType) {
      const agLabels: Record<string, [string, string]> = {
        grain: ['🌾', 'Grain Field'],
        garden: ['🌿', 'Garden'],
        pasture: ['🐄', 'Pasture'],
      };
      const [icon, label] = agLabels[agType] ?? ['🏗️', agType];
      buildingIcon = icon;
      buildingName = label;
    }
  }

  // Per-region river/forest for build eligibility
  const hasRiver = regionHasRiver(selectedRegion, gameState.hydro);
  const hasForest = regionHasForest(selectedRegion, terrain, moisture);

  // Build menu: only show for player regions with no building
  const showBuildMenu = isPlayerRegion && !buildingName && playerEconomy;
  const resources = playerEconomy?.resources as unknown as Record<string, number> | undefined;

  // Sort buildings: available first, then unaffordable, then unavailable
  const STATUS_ORDER: Record<BuildStatus, number> = { available: 0, unaffordable: 1, unavailable: 2 };
  const buildOptions = showBuildMenu && resources
    ? ALL_BUILDING_TYPES
        .map(t => ({
          def: BUILDING_DEFS[t],
          status: getBuildStatus(BUILDING_DEFS[t], terrain, hasRiver, hasForest, resources),
        }))
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    : [];

  return (
    <div className="panel region-panel">
      <button className="panel-close" onClick={() => setSelectedRegion(null)}>✕</button>

      <h3>Region {selectedRegion}</h3>

      <div className="panel-row">
        <span className="panel-label">Terrain</span>
        <span className="panel-value">{terrain}</span>
      </div>
      <div className="panel-row">
        <span className="panel-label">Elevation</span>
        <span className="panel-value">{(elevation * 100).toFixed(1)}%</span>
      </div>
      <div className="panel-row">
        <span className="panel-label">Moisture</span>
        <span className="panel-value">{(moisture * 100).toFixed(1)}%</span>
      </div>
      {hasRiver && (
        <div className="panel-row">
          <span className="panel-label">Features</span>
          <span className="panel-value" style={{ color: '#6bafcf' }}>River</span>
        </div>
      )}
      {hasForest && (
        <div className="panel-row">
          <span className="panel-label">{hasRiver ? '' : 'Features'}</span>
          <span className="panel-value" style={{ color: '#6bc76b' }}>Forest</span>
        </div>
      )}

      {/* Existing building */}
      {buildingName && (
        <div className="rp-building-display">
          <span className="rp-building-icon">{buildingIcon}</span>
          <span className="rp-building-name">{buildingName}</span>
        </div>
      )}

      {/* Duchy badge */}
      {duchy && house && (
        <div className="duchy-badge" style={{ borderLeftColor: colorHex }}>
          <div>
            <div className="duchy-badge-name" style={{ color: colorHex }}>
              {house.sigil} {house.name}
              {isCapital && <span style={{ opacity: 0.6, fontSize: '0.72rem' }}> (Capital)</span>}
            </div>
            <div className="duchy-badge-ruler">{house.rulerName} {house.epithet}</div>
            <div className="duchy-badge-axis">{house.axis} economy</div>
          </div>
        </div>
      )}

      {!duchy && (
        <p className="unclaimed-label">Unclaimed wilderness</p>
      )}

      {/* Build menu for player-owned empty regions */}
      {showBuildMenu && buildOptions.length > 0 && (
        <div className="rp-build-menu">
          <div className="rp-build-header">Available Buildings</div>
          <div className="rp-build-list">
            {buildOptions.map(({ def, status }) => (
              <BuildOption key={def.type} def={def} status={status} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
