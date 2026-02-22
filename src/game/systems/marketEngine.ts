import type { ResourceType } from '../../types';

export const MARKET_BASE_PRICE: Partial<Record<ResourceType, number>> = {
  grain: 1,
  timber: 1,
  ore: 2,
  cloth: 3,
  spice: 8,
  cattle: 2,
  fish: 1,
  deer: 2,
  apples: 1,
  bread: 2,
  cheese: 4,
  smoked_meat: 3,
  pie: 6,
};

export interface MarketPrice {
  sell: number;
  buy: number;
}

const REF_STOCK = 20;

export function getMarketPrices(resource: ResourceType, currentStock: number): MarketPrice {
  const base = MARKET_BASE_PRICE[resource] ?? 1;
  const scarcity = Math.min(2.0, Math.max(0.5, REF_STOCK / Math.max(1, currentStock)));
  const sell = Math.round(base * scarcity * 0.65 * 10) / 10;
  const buy = Math.round((base / scarcity) * 1.35 * 10) / 10;
  return { sell, buy };
}

export const TRADEABLE_RESOURCES: ResourceType[] = [
  'grain', 'timber', 'ore', 'cloth', 'spice',
  'cattle', 'fish', 'deer', 'apples',
  'bread', 'cheese', 'smoked_meat', 'pie',
];

export const RESOURCE_EMOJI: Partial<Record<ResourceType, string>> = {
  grain: '🌾',
  timber: '🪵',
  ore: '⛏️',
  cloth: '🧵',
  spice: '🌶️',
  cattle: '🐄',
  fish: '🐟',
  deer: '🦌',
  apples: '🍎',
  bread: '🍞',
  cheese: '🧀',
  smoked_meat: '🥩',
  pie: '🥧',
};
