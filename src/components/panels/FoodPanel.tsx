import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import {
  FOOD_KEYS,
  RATION_MULTIPLIERS, HAPPINESS_FROM_RATIONS,
  computeProduction, countTerrain,
  type ResourceType, type RationLevel,
} from '../../state/Economy';
import { type BuildingType } from '../../state/Building';
import { ResourceIcon } from '../ui/ResourceIcon';

const FOOD_META: Record<string, { label: string; icon: string }> = {
  grain:       { label: 'Grain',       icon: '🌾' },
  cattle:      { label: 'Cattle',      icon: '🐄' },
  fish:        { label: 'Fish',        icon: '🐟' },
  deer:        { label: 'Deer',        icon: '🦌' },
  apples:      { label: 'Apples',      icon: '🍎' },
  vegetables:  { label: 'Vegetables',  icon: '🥬' },
  meat:        { label: 'Meat',        icon: '🍖' },
  milk:        { label: 'Milk',        icon: '🥛' },
  bread:       { label: 'Bread',       icon: '🍞' },
  cheese:      { label: 'Cheese',      icon: '🧀' },
  smoked_meat: { label: 'Smoked Meat', icon: '🥩' },
  smoked_fish: { label: 'Smoked Fish', icon: '🐟' },
  pie:         { label: 'Pie',         icon: '🥧' },
};

const RATION_LABELS: Record<RationLevel, string> = {
  none: 'None', meager: 'Meager', normal: 'Normal', extra: 'Extra',
};

export function FoodPanel() {
  const { playerEconomy, playerDuchy, gameState, setRationLevel, setFoodProcessing } = useGameStore();
  const { openPanel, setOpenPanel } = useUIStore();

  if (openPanel !== 'food' || !playerEconomy || !playerDuchy || !gameState) return null;

  const { resources, population, rationLevel, laborAssignment, foodProcessing } = playerEconomy;

  const countBuildings = (type: BuildingType) =>
    gameState.buildings.filter(b => b.type === type && b.duchyIndex === gameState.playerDuchy && !b.constructing).length;

  // ─── Production from terrain ───────────────────────────────────────────────
  const terrain = countTerrain(
    playerDuchy.regions, gameState.topo.terrainType,
    playerDuchy.hasRiver, playerDuchy.hasForest,
  );
  const production = computeProduction(terrain, laborAssignment);

  // ─── Processing capacity ───────────────────────────────────────────────────
  const smokehouses = countBuildings('smokehouse');
  const kitchens = countBuildings('kitchen');
  const bakeries = countBuildings('bakery');
  const dairies = countBuildings('dairy');

  const smokeCap = smokehouses * 2;
  const cheeseCap = dairies * 2;
  const breadCap = (kitchens + bakeries) * 2;
  const pieCap = bakeries * 2;

  // ─── Pipeline forecast ─────────────────────────────────────────────────────
  const fp = foodProcessing;

  // Dairy industry
  const cattleProd = production.cattle ?? 0;
  const cattleTotal = resources.cattle + cattleProd;
  const toSlaughter = Math.min(fp.cattleSlaughter, cattleTotal);
  const nonSlaughtered = Math.max(0, cattleProd - toSlaughter);
  const dairyUnits = Math.floor(nonSlaughtered * 0.5);
  const forecastCheese = Math.min(Math.floor(dairyUnits * fp.dairyCheeseSplit / 100), cheeseCap);
  const forecastMilk = dairyUnits - forecastCheese;

  // Fishery industry
  const fishProd = production.fish ?? 0;
  const deerProd = production.deer ?? 0;
  const meatPool = toSlaughter + fishProd + deerProd;
  const forecastSmoked = Math.min(Math.floor(meatPool * fp.meatSmokingRatio / 100), smokeCap);
  const forecastMeat = meatPool - forecastSmoked;

  // Bread industry
  const grainProd = production.grain ?? 0;
  const grainTotal = resources.grain + grainProd;
  const appleTotal = resources.apples + (production.apples ?? 0);
  const piePotential = Math.min(appleTotal, grainTotal);
  const forecastPie = Math.min(Math.floor(piePotential * fp.pieBakingRatio / 100), pieCap);
  const grainAfterPie = grainTotal - forecastPie;
  const forecastBread = Math.min(Math.floor(grainAfterPie * fp.grainBakingRatio / 100), breadCap, grainAfterPie);

  // ─── Totals ────────────────────────────────────────────────────────────────
  const totalEat = Math.round(population.total * RATION_MULTIPLIERS[rationLevel]);
  const happinessDelta = HAPPINESS_FROM_RATIONS[rationLevel];
  const totalStock = FOOD_KEYS.reduce((s, k) => s + (resources[k as keyof typeof resources] ?? 0), 0);
  const totalProd = FOOD_KEYS.reduce((s, k) => s + (production[k] ?? 0), 0);

  function canAffordRation(level: RationLevel): boolean {
    const needed = Math.ceil(population.total * RATION_MULTIPLIERS[level]);
    return needed === 0 || totalStock >= needed;
  }

  // ─── Row helper ────────────────────────────────────────────────────────────
  function foodRow(key: ResourceType, prod: number, showStock = true) {
    const meta = FOOD_META[key];
    if (!meta) return null;
    const stock = resources[key] ?? 0;
    const empty = stock === 0 && prod === 0;
    return (
      <tr key={key} className={empty ? 'fp-row-empty' : ''}>
        <td><ResourceIcon type={key} fallback={meta.icon} size={14} /> {meta.label}</td>
        <td className="fp-num">{showStock && stock > 0 ? stock : '—'}</td>
        <td className="fp-num fp-prod">{prod > 0 ? `+${prod}` : '—'}</td>
      </tr>
    );
  }

  return (
    <div className="modal-backdrop" onClick={() => setOpenPanel(null)}>
      <div className="modal-box fp-box" onClick={e => e.stopPropagation()}>
        <button className="panel-close" onClick={() => setOpenPanel(null)}>✕</button>
        <h3>🌾 Food Supply &amp; Demand</h3>

        {/* Labor Slider */}
        <div className="fp-labor-row">
          <span className="fp-labor-label">🌾 Food ({Math.round(population.total * (100 - fp.foodLaborRatio) / 100)})</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={fp.foodLaborRatio}
            onChange={e => setFoodProcessing({ foodLaborRatio: Number(e.target.value) })}
          />
          <span className="fp-labor-label">⛏️ Resource ({Math.round(population.total * fp.foodLaborRatio / 100)})</span>
        </div>

        {/* Rations */}
        <div className="fp-ration-row">
          <span className="fp-ration-label">Rations</span>
          <div className="ration-pills">
            {(['none', 'meager', 'normal', 'extra'] as RationLevel[]).map(level => (
              <button
                key={level}
                className={`ration-pill${rationLevel === level ? ' ration-pill--active' : ''}${!canAffordRation(level) ? ' ration-pill--disabled' : ''}`}
                onClick={() => canAffordRation(level) && setRationLevel(level)}
                disabled={!canAffordRation(level)}
              >
                {RATION_LABELS[level]}
              </button>
            ))}
          </div>
          <span className="fp-ration-hint">
            {totalEat > 0 ? <>{`-${totalEat}`} 🍖</> : null}
            {' '}
            {happinessDelta !== 0 ? <>{happinessDelta > 0 ? '+' : ''}{happinessDelta} ❤️</> : null}
          </span>
        </div>

        {/* ── Fresh ── */}
        <div className="fp-section-header">🥬 Fresh</div>
        <table className="fp-table">
          <thead><tr>
            <th className="fp-th-food">Food</th>
            <th className="fp-th-num">Stock</th>
            <th className="fp-th-num">Prod</th>
          </tr></thead>
          <tbody>
            {foodRow('vegetables', production.vegetables ?? 0)}
            {foodRow('apples', production.apples ?? 0)}
          </tbody>
        </table>

        {/* ── Dairy Industry ── */}
        <div className="fp-section-header">🐄 Dairy Industry</div>
        <table className="fp-table">
          <thead><tr>
            <th className="fp-th-food">Food</th>
            <th className="fp-th-num">Stock</th>
            <th className="fp-th-num">Prod</th>
          </tr></thead>
          <tbody>
            {foodRow('cattle', cattleProd)}
          </tbody>
        </table>
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🔪 Slaughter</span>
          <input type="range" className="fp-slider" min={0} max={Math.max(1, cattleTotal)}
            value={Math.min(fp.cattleSlaughter, cattleTotal)}
            onChange={e => setFoodProcessing({ cattleSlaughter: Number(e.target.value) })}
          />
          <span className="fp-pipeline-value">{Math.min(fp.cattleSlaughter, cattleTotal)} / {cattleTotal}</span>
        </div>
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🥛 Milk</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={fp.dairyCheeseSplit}
            onChange={e => setFoodProcessing({ dairyCheeseSplit: Number(e.target.value) })}
            disabled={dairies === 0}
            title={dairies === 0 ? 'Build a Dairy to make cheese' : ''}
          />
          <span className="fp-pipeline-label">🧀 Cheese</span>
          {dairies > 0 && <span className="fp-pipeline-value">cap {cheeseCap}</span>}
        </div>
        <table className="fp-table">
          <tbody>
            {foodRow('milk', forecastMilk, false)}
            {foodRow('cheese', forecastCheese, true)}
          </tbody>
        </table>

        {/* ── Fishery Industry ── */}
        <div className="fp-section-header">🐟 Fishery Industry</div>
        <table className="fp-table">
          <thead><tr>
            <th className="fp-th-food">Food</th>
            <th className="fp-th-num">Stock</th>
            <th className="fp-th-num">Prod</th>
          </tr></thead>
          <tbody>
            {foodRow('fish', fishProd)}
            {foodRow('deer', deerProd)}
          </tbody>
        </table>
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🥩 Smoke</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={fp.meatSmokingRatio}
            onChange={e => setFoodProcessing({ meatSmokingRatio: Number(e.target.value) })}
            disabled={smokehouses === 0}
            title={smokehouses === 0 ? 'Build a Smokehouse to smoke meat' : smokeCap <= forecastSmoked ? 'Build more Smokehouses to increase capacity' : ''}
          />
          <span className="fp-pipeline-value">{fp.meatSmokingRatio}%{smokehouses > 0 ? ` · cap ${smokeCap}` : ''}</span>
        </div>
        <table className="fp-table">
          <tbody>
            {foodRow('meat', forecastMeat, false)}
            {foodRow('smoked_meat', forecastSmoked, true)}
          </tbody>
        </table>

        {/* ── Bread Industry ── */}
        <div className="fp-section-header">🌾 Bread Industry</div>
        <table className="fp-table">
          <thead><tr>
            <th className="fp-th-food">Food</th>
            <th className="fp-th-num">Stock</th>
            <th className="fp-th-num">Prod</th>
          </tr></thead>
          <tbody>
            {foodRow('grain', grainProd)}
          </tbody>
        </table>
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🍞 Bake</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={fp.grainBakingRatio}
            onChange={e => setFoodProcessing({ grainBakingRatio: Number(e.target.value) })}
            disabled={kitchens + bakeries === 0}
            title={kitchens + bakeries === 0 ? 'Build a Kitchen or Bakery to bake bread' : ''}
          />
          <span className="fp-pipeline-value">{fp.grainBakingRatio}%{kitchens + bakeries > 0 ? ` · cap ${breadCap}` : ''}</span>
        </div>
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🥧 Pie</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={fp.pieBakingRatio}
            onChange={e => setFoodProcessing({ pieBakingRatio: Number(e.target.value) })}
            disabled={bakeries === 0}
            title={bakeries === 0 ? 'Build a Bakery to bake pies' : ''}
          />
          <span className="fp-pipeline-value">{fp.pieBakingRatio}%{bakeries > 0 ? ` · cap ${pieCap}` : ''}</span>
        </div>
        <table className="fp-table">
          <tbody>
            {foodRow('bread', forecastBread * 2, true)}
            {foodRow('pie', forecastPie * 2, true)}
          </tbody>
        </table>

        {/* Totals */}
        <div className="fp-section-header">Summary</div>
        <table className="fp-table">
          <tbody>
            <tr className="fp-total-row">
              <td>Total Food</td>
              <td className="fp-num">{totalStock}</td>
              <td className="fp-num fp-prod">{totalProd > 0 ? `+${totalProd}` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
