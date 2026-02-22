import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { TRADEABLE_RESOURCES, RESOURCE_EMOJI, getMarketPrices } from '../../game/systems/marketEngine';
import type { Resources } from '../../types';

interface MarketPanelProps {
  resources: Resources;
}

const QTY_OPTIONS = [1, 5, 10] as const;
type Qty = typeof QTY_OPTIONS[number];

export function MarketPanel({ resources }: MarketPanelProps) {
  const [qty, setQty] = useState<Qty>(1);
  const { buyResource, sellResource } = useGameStore();

  return (
    <div className="market-panel">
      <div className="market-balance">💰 {resources.gold.toFixed(1)} gold</div>

      <div className="market-qty-selector">
        <span>Qty:</span>
        {QTY_OPTIONS.map(q => (
          <button
            key={q}
            className={`market-qty-btn${qty === q ? ' market-qty-btn--active' : ''}`}
            onClick={() => setQty(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <table className="market-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Stock</th>
            <th>Sell</th>
            <th>Buy</th>
          </tr>
        </thead>
        <tbody>
          {TRADEABLE_RESOURCES.map(resource => {
            const stock = resources[resource] ?? 0;
            const prices = getMarketPrices(resource, stock);
            const sellTotal = Math.round(prices.sell * qty * 10) / 10;
            const buyTotal = Math.round(prices.buy * qty * 10) / 10;
            const canSell = stock >= qty;
            const canBuy = resources.gold >= buyTotal;

            return (
              <tr key={resource}>
                <td className="market-resource-name">
                  {RESOURCE_EMOJI[resource]} {resource.replace('_', ' ')}
                </td>
                <td className="market-stock">{stock}</td>
                <td>
                  <button
                    className="market-btn market-btn--sell"
                    disabled={!canSell}
                    onClick={() => sellResource(resource, qty)}
                    title={`Sell ${qty} for +${sellTotal}g`}
                  >
                    {qty} +{sellTotal}g
                  </button>
                </td>
                <td>
                  <button
                    className="market-btn market-btn--buy"
                    disabled={!canBuy}
                    onClick={() => buyResource(resource, qty)}
                    title={`Buy ${qty} for ${buyTotal}g`}
                  >
                    {qty} -{buyTotal}g
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
