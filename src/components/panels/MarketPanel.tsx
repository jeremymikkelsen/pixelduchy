import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import type { ResourceType } from '../../state/Economy';
import { getMarketPrice, BASE_MARKET_PRICES } from '../../state/Economy';
import { ResourceIcon } from '../ui/ResourceIcon';

const TRADEABLE: { key: ResourceType; label: string; icon: string }[] = [
  { key: 'grain',       label: 'Grain',       icon: '🌾' },
  { key: 'cattle',      label: 'Cattle',      icon: '🐄' },
  { key: 'fish',        label: 'Fish',        icon: '🐟' },
  { key: 'apples',      label: 'Apples',      icon: '🍎' },
  { key: 'timber',      label: 'Timber',      icon: '🪵' },
  { key: 'ore',         label: 'Ore',         icon: '⛏️' },
  { key: 'stone',       label: 'Stone',       icon: '🪨' },
  { key: 'iron',        label: 'Iron',        icon: '⚙️' },
  { key: 'cloth',       label: 'Cloth',       icon: '🧵' },
  { key: 'bread',       label: 'Bread',       icon: '🍞' },
  { key: 'cheese',      label: 'Cheese',      icon: '🧀' },
  { key: 'smoked_meat', label: 'Smoked Meat', icon: '🥩' },
  { key: 'pie',         label: 'Pie',         icon: '🥧' },
  { key: 'deer',        label: 'Deer',        icon: '🦌' },
];

function priceTrend(dynamicBuy: number, key: ResourceType): string {
  const base = BASE_MARKET_PRICES[key] ?? 5;
  if (dynamicBuy > base) return ' ↑';
  if (dynamicBuy < base) return ' ↓';
  return '';
}

export function MarketPanel() {
  const { openPanel, setOpenPanel } = useUIStore();
  const { playerEconomy, playerHouse, gameState } = useGameStore();

  if (openPanel !== 'market' || !playerEconomy || !gameState) return null;

  const { resources } = playerEconomy;
  const gold = resources.gold;
  const house = playerHouse ?? null;

  function buy(key: ResourceType) {
    const stock = resources[key] ?? 0;
    const price = getMarketPrice(key, stock, house, true);
    if (gold < price) return;
    const eco = gameState!.economies[gameState!.playerDuchy];
    eco.resources.gold -= price;
    eco.resources[key] += 1;
    useGameStore.setState({ playerEconomy: { ...eco } });
  }

  function sell(key: ResourceType) {
    const stock = resources[key] ?? 0;
    if (stock < 1) return;
    const price = getMarketPrice(key, stock, house, false);
    const eco = gameState!.economies[gameState!.playerDuchy];
    eco.resources[key] -= 1;
    eco.resources.gold += price;
    useGameStore.setState({ playerEconomy: { ...eco } });
  }

  return (
    <div className="modal-backdrop" onClick={() => setOpenPanel(null)}>
      <div className="modal-box fp-box" onClick={e => e.stopPropagation()}>
        <button className="panel-close" onClick={() => setOpenPanel(null)}>✕</button>
        <h3>💰 Market</h3>
        <div className="mkt-gold">Gold: <strong>{gold}</strong></div>

        <table className="fp-table">
          <thead>
            <tr>
              <th className="fp-th-food">Resource</th>
              <th className="fp-th-num">Stock</th>
              <th className="fp-th-num">Buy</th>
              <th className="fp-th-num">Sell</th>
            </tr>
          </thead>
          <tbody>
            {TRADEABLE.map(({ key, label, icon }) => {
              const stock = resources[key] ?? 0;
              const buyPrice = getMarketPrice(key, stock, house, true);
              const sellPrice = getMarketPrice(key, stock, house, false);
              const trend = priceTrend(buyPrice, key);
              const canBuy = gold >= buyPrice;
              const canSell = stock > 0;
              return (
                <tr key={key}>
                  <td><ResourceIcon type={key} fallback={icon} size={14} /> {label}</td>
                  <td className="fp-num">{stock}</td>
                  <td className="fp-num">
                    <button
                      className="mkt-btn mkt-btn--buy"
                      disabled={!canBuy}
                      onClick={() => buy(key)}
                    >
                      {buyPrice}g{trend}
                    </button>
                  </td>
                  <td className="fp-num">
                    <button
                      className="mkt-btn mkt-btn--sell"
                      disabled={!canSell}
                      onClick={() => sell(key)}
                    >
                      {sellPrice}g
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
