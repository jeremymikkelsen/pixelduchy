import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import {
  FOOD_KEYS, RAW_FOOD_KEYS, PROCESSED_FOOD_KEYS,
  RATION_MULTIPLIERS, HAPPINESS_FROM_RATIONS,
  computeProduction, countTerrain,
  type ResourceType, type RationLevel, type FoodProcessing,
} from '../../state/Economy';
import { BUILDING_DEFS, type BuildingType } from '../../state/Building';
import { ResourceIcon } from '../ui/ResourceIcon';

const FOOD_META: { key: ResourceType; label: string; icon: string }[] = [
  { key: 'grain',       label: 'Grain',       icon: '🌾' },
  { key: 'cattle',      label: 'Cattle',      icon: '🐄' },
  { key: 'fish',        label: 'Fish',        icon: '🐟' },
  { key: 'deer',        label: 'Deer',        icon: '🦌' },
  { key: 'apples',      label: 'Apples',      icon: '🍎' },
  { key: 'vegetables',  label: 'Vegetables',  icon: '🥬' },
  { key: 'meat',        label: 'Meat',        icon: '🍖' },
  { key: 'milk',        label: 'Milk',        icon: '🥛' },
  { key: 'bread',       label: 'Bread',       icon: '🍞' },
  { key: 'cheese',      label: 'Cheese',      icon: '🧀' },
  { key: 'smoked_meat', label: 'Smoked Meat', icon: '🥩' },
  { key: 'pie',         label: 'Pie',         icon: '🥧' },
];

const FOOD_META_MAP = new Map(FOOD_META.map(f => [f.key, f]));

const RATION_LABELS: Record<RationLevel, string> = {
  none: 'None', meager: 'Meager', normal: 'Normal', extra: 'Extra',
};

export function FoodPanel() {
  const { playerEconomy, playerDuchy, gameState, setRationLevel, setFoodEatOrder, setFoodProcessing } = useGameStore();
  const { openPanel, setOpenPanel } = useUIStore();

  if (openPanel !== 'food' || !playerEconomy || !playerDuchy || !gameState) return null;

  const { resources, population, rationLevel, foodEatOrder, laborAssignment, foodProcessing } = playerEconomy;

  // ─── Building count helper ─────────────────────────────────────────────────
  const countBuildings = (type: BuildingType) =>
    gameState.buildings.filter(b => b.type === type && b.duchyIndex === gameState.playerDuchy && !b.constructing).length;

  // ─── Eat order (unified across raw + processed) ────────────────────────────
  const allFoodKeys = FOOD_META.map(f => f.key);
  const eatOrder: ResourceType[] = foodEatOrder ?? allFoodKeys;

  const orderedFood = [
    ...eatOrder.filter(k => FOOD_META_MAP.has(k)),
    ...allFoodKeys.filter(k => !eatOrder.includes(k)),
  ];

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

  // ─── Forecast: simulate pipeline to compute processed food production ──────
  const processedProd: Partial<Record<ResourceType, number>> = {};
  {
    const fp = foodProcessing;

    // Cattle slaughter -> meat
    const toSlaughter = Math.min(fp.cattleSlaughter, resources.cattle + (production.cattle ?? 0));
    processedProd.meat = toSlaughter;

    // Fish/deer new production -> meat
    const newFish = production.fish ?? 0;
    const newDeer = production.deer ?? 0;
    processedProd.meat = (processedProd.meat ?? 0) + newFish + newDeer;

    // Meat smoking
    const meatPool = processedProd.meat ?? 0;
    const toSmoke = Math.min(Math.floor(meatPool * fp.meatSmokingRatio / 100), smokeCap);
    processedProd.smoked_meat = toSmoke;
    processedProd.meat = meatPool - toSmoke;

    // Dairy: milk/cheese from non-slaughtered cattle production
    const nonSlaughteredProd = Math.max(0, (production.cattle ?? 0) - fp.cattleSlaughter);
    const dairyUnits = Math.floor(nonSlaughteredProd * 0.5);
    const cheeseUnits = Math.min(Math.floor(dairyUnits * fp.dairyCheeseSplit / 100), cheeseCap);
    const milkUnits = dairyUnits - cheeseUnits;
    processedProd.milk = milkUnits;
    processedProd.cheese = cheeseUnits;

    // Pie: apples + grain -> pie (before bread)
    const grainAvail = (resources.grain ?? 0) + (production.grain ?? 0);
    const applesAvail = (resources.apples ?? 0) + (production.apples ?? 0);
    const piePotential = Math.min(applesAvail, grainAvail);
    const pieToBake = Math.min(Math.floor(piePotential * fp.pieBakingRatio / 100), pieCap);
    processedProd.pie = pieToBake * 2;

    // Bread: grain -> bread (after pie consumed some grain)
    const grainAfterPie = grainAvail - pieToBake;
    const grainToBake = Math.min(Math.floor(grainAfterPie * fp.grainBakingRatio / 100), breadCap, grainAfterPie);
    processedProd.bread = grainToBake * 2;
  }

  // ─── Forecast after production ─────────────────────────────────────────────
  const afterProd: Partial<Record<ResourceType, number>> = {};
  for (const { key } of FOOD_META) {
    afterProd[key] = (resources[key] ?? 0) + (production[key] ?? 0);
  }

  const totalEat = Math.round(population.total * RATION_MULTIPLIERS[rationLevel]);

  const eatsPerType: Partial<Record<ResourceType, number>> = {};
  let eatRem = Math.min(totalEat, FOOD_KEYS.reduce((s, k) => s + (afterProd[k] ?? 0), 0));
  for (const key of eatOrder) {
    if (eatRem <= 0) break;
    const take = Math.min(afterProd[key] ?? 0, eatRem);
    if (take > 0) eatsPerType[key] = take;
    eatRem -= take;
  }

  const afterEat: Partial<Record<ResourceType, number>> = {};
  for (const { key } of FOOD_META) {
    afterEat[key] = (afterProd[key] ?? 0) - (eatsPerType[key] ?? 0);
  }
  const wastePerType: Partial<Record<ResourceType, number>> = {};
  let wasteRem = Math.ceil(FOOD_KEYS.reduce((s, k) => s + (afterEat[k] ?? 0), 0) * 0.02);
  for (const key of eatOrder) {
    if (wasteRem <= 0) break;
    const take = Math.min(afterEat[key] ?? 0, wasteRem);
    if (take > 0) wastePerType[key] = take;
    wasteRem -= take;
  }

  const totalStock = FOOD_META.reduce((s, { key }) => s + (resources[key] ?? 0), 0);
  const totalProd = FOOD_META.reduce((s, { key }) => s + (production[key] ?? 0), 0);
  const totalEaten = Object.values(eatsPerType).reduce((s, v) => s + (v ?? 0), 0);
  const totalWaste = Object.values(wastePerType).reduce((s, v) => s + (v ?? 0), 0);
  const happinessDelta = HAPPINESS_FROM_RATIONS[rationLevel];
  const currentFood = totalStock;

  function canAffordRation(level: RationLevel): boolean {
    const needed = Math.ceil(population.total * RATION_MULTIPLIERS[level]);
    return needed === 0 || currentFood >= needed;
  }

  function moveEatOrder(index: number, direction: -1 | 1) {
    // Work on the unified order array
    const newOrder = [...orderedFood];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setFoodEatOrder(newOrder);
  }

  // ─── Helpers for split tables ──────────────────────────────────────────────
  const rawOrdered = orderedFood.filter(k => RAW_FOOD_KEYS.includes(k));
  const processedOrdered = orderedFood.filter(k => PROCESSED_FOOD_KEYS.includes(k));

  function renderFoodTable(
    keys: ResourceType[],
    prodSource: Partial<Record<ResourceType, number>>,
    sectionKeys: ResourceType[],
  ) {
    return (
      <table className="fp-table">
        <thead>
          <tr>
            <th className="fp-th-order">Order</th>
            <th className="fp-th-food">Food</th>
            <th className="fp-th-num">Stock</th>
            <th className="fp-th-num">Prod</th>
            <th className="fp-th-num">Eats</th>
            <th className="fp-th-num">Waste</th>
          </tr>
        </thead>
        <tbody>
          {keys.map(key => {
            const meta = FOOD_META_MAP.get(key)!;
            const stock = resources[key] ?? 0;
            const prod = prodSource[key] ?? 0;
            const eats = eatsPerType[key] ?? 0;
            const waste = wastePerType[key] ?? 0;
            const empty = stock === 0 && prod === 0;
            // Index in the unified order for move operations
            const unifiedIdx = orderedFood.indexOf(key);
            return (
              <tr key={key} className={empty ? 'fp-row-empty' : ''}>
                <td className="fp-num fp-order-btns">
                  <button className="fp-order-btn" onClick={() => moveEatOrder(unifiedIdx, -1)} disabled={unifiedIdx === 0}>↑</button>
                  <button className="fp-order-btn" onClick={() => moveEatOrder(unifiedIdx, 1)} disabled={unifiedIdx === orderedFood.length - 1}>↓</button>
                </td>
                <td><ResourceIcon type={key} fallback={meta.icon} size={14} /> {meta.label}</td>
                <td className="fp-num">{stock > 0 ? stock : '—'}</td>
                <td className="fp-num fp-prod">{prod > 0 ? `+${prod}` : '—'}</td>
                <td className="fp-num fp-eat">{eats > 0 ? eats : '—'}</td>
                <td className="fp-num fp-waste">{waste > 0 ? waste : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <div className="modal-backdrop" onClick={() => setOpenPanel(null)}>
      <div className="modal-box fp-box" onClick={e => e.stopPropagation()}>
        <button className="panel-close" onClick={() => setOpenPanel(null)}>✕</button>
        <h3>🌾 Food Supply &amp; Demand</h3>

        {/* 1. Labor Slider */}
        <div className="fp-labor-row">
          <span className="fp-labor-label">🌾 Food Industry ({Math.round(population.total * (100 - foodProcessing.foodLaborRatio) / 100)})</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={foodProcessing.foodLaborRatio}
            onChange={e => setFoodProcessing({ foodLaborRatio: Number(e.target.value) })}
          />
          <span className="fp-labor-label">⛏️ Resource Industry ({Math.round(population.total * foodProcessing.foodLaborRatio / 100)})</span>
        </div>

        {/* 2. Rations */}
        <div className="fp-ration-row">
          <span className="fp-ration-label">Rations</span>
          <div className="ration-pills">
            {(['none', 'meager', 'normal', 'extra'] as RationLevel[]).map(level => {
              const affordable = canAffordRation(level);
              return (
                <button
                  key={level}
                  className={`ration-pill${rationLevel === level ? ' ration-pill--active' : ''}${!affordable ? ' ration-pill--disabled' : ''}`}
                  onClick={() => affordable && setRationLevel(level)}
                  disabled={!affordable}
                >
                  {RATION_LABELS[level]}
                </button>
              );
            })}
          </div>
          <span className="fp-ration-hint">
            {totalEat > 0 ? <>{`-${totalEat}`} 🍖</> : null}
            {' '}
            {happinessDelta !== 0 ? <>{happinessDelta > 0 ? '+' : ''}{happinessDelta} ❤️</> : null}
          </span>
        </div>

        {/* 3. Raw Production */}
        <div className="fp-section-header">Raw Production</div>
        {renderFoodTable(rawOrdered, production, RAW_FOOD_KEYS)}

        {/* 4. Processing */}
        <div className="fp-section-header">Processing</div>

        {/* Cattle Slaughter */}
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🔪 Slaughter</span>
          <input type="range" className="fp-slider" min={0} max={resources.cattle}
            value={Math.min(foodProcessing.cattleSlaughter, resources.cattle)}
            onChange={e => setFoodProcessing({ cattleSlaughter: Number(e.target.value) })}
          />
          <span className="fp-pipeline-value">{Math.min(foodProcessing.cattleSlaughter, resources.cattle)} / {resources.cattle} cattle</span>
        </div>

        {/* Meat Smoking */}
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🥩 Smoking</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={foodProcessing.meatSmokingRatio}
            onChange={e => setFoodProcessing({ meatSmokingRatio: Number(e.target.value) })}
            disabled={smokehouses === 0}
            title={smokehouses === 0 ? 'Build a Smokehouse to smoke meat' : smokeCap <= (processedProd.smoked_meat ?? 0) ? 'Build more Smokehouses to increase capacity' : ''}
          />
          <span className="fp-pipeline-value">{foodProcessing.meatSmokingRatio}% · cap {smokeCap}</span>
        </div>

        {/* Dairy (Milk/Cheese split) */}
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🥛 Milk</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={foodProcessing.dairyCheeseSplit}
            onChange={e => setFoodProcessing({ dairyCheeseSplit: Number(e.target.value) })}
            disabled={dairies === 0}
            title={dairies === 0 ? 'Build a Dairy to make cheese' : cheeseCap <= (processedProd.cheese ?? 0) ? 'Build more Dairies to increase capacity' : ''}
          />
          <span className="fp-pipeline-label">🧀 Cheese</span>
          <span className="fp-pipeline-value">cap {cheeseCap}</span>
        </div>

        {/* Bread */}
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🍞 Bread</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={foodProcessing.grainBakingRatio}
            onChange={e => setFoodProcessing({ grainBakingRatio: Number(e.target.value) })}
            disabled={kitchens + bakeries === 0}
            title={kitchens + bakeries === 0 ? 'Build a Kitchen or Bakery to bake bread' : ''}
          />
          <span className="fp-pipeline-value">{foodProcessing.grainBakingRatio}% · cap {breadCap}</span>
        </div>

        {/* Pie */}
        <div className="fp-pipeline-row">
          <span className="fp-pipeline-label">🥧 Pie</span>
          <input type="range" className="fp-slider" min={0} max={100}
            value={foodProcessing.pieBakingRatio}
            onChange={e => setFoodProcessing({ pieBakingRatio: Number(e.target.value) })}
            disabled={bakeries === 0}
            title={bakeries === 0 ? 'Build a Bakery to bake pies' : ''}
          />
          <span className="fp-pipeline-value">{foodProcessing.pieBakingRatio}% · cap {pieCap}</span>
        </div>

        {/* 5. Processed Foods */}
        <div className="fp-section-header">Processed Foods</div>
        {renderFoodTable(processedOrdered, processedProd, PROCESSED_FOOD_KEYS)}

        {/* 6. Totals */}
        <table className="fp-table">
          <tfoot>
            <tr className="fp-total-row">
              <td />
              <td>Total</td>
              <td className="fp-num">{totalStock}</td>
              <td className="fp-num fp-prod">{totalProd > 0 ? `+${totalProd}` : '—'}</td>
              <td className="fp-num fp-eat">{totalEaten > 0 ? totalEaten : '—'}</td>
              <td className="fp-num fp-waste">{totalWaste > 0 ? totalWaste : '—'}</td>
            </tr>
          </tfoot>
        </table>

        {/* 7. Footer */}
        <p className="fp-hint-text">↑/↓ sets which foods are eaten first each turn.</p>
      </div>
    </div>
  );
}
