import type { HouseData } from './Duchy';

const FOOD_TYPES = new Set([
  'grain', 'cattle', 'fish', 'deer', 'apples',
  'bread', 'cheese', 'smoked_meat', 'pie',
]);

const AGRARIAN_BUILDINGS = new Set(['field', 'pasture', 'orchard']);

export function getBuildingCostModifier(house: HouseData, buildingType: string, resource: string): number {
  switch (house.name) {
    case 'House Aldren':
      return resource === 'timber' ? 0.8 : 1.0;
    case 'House Vael':
      return AGRARIAN_BUILDINGS.has(buildingType) ? 0.85 : 1.0;
    case 'House Varek':
      return buildingType === 'barracks' ? 0.8 : 1.0;
    case 'House Brynn':
      return buildingType === 'barracks' && resource === 'timber' ? 0 : 1.0;
    default:
      return 1.0;
  }
}

export function getProductionModifier(house: HouseData, resourceType: string): number {
  switch (house.name) {
    case 'House Vael':
      return (FOOD_TYPES.has(resourceType) || resourceType === 'timber') ? 1.2 : 1.0;
    case 'House Orvyn':
      return 1.15;
    default:
      return 1.0;
  }
}

export function getSpoilageRate(house: HouseData): number {
  return house.name === 'House Orvyn' ? 0 : 0.02;
}

export function getMarketSellModifier(house: HouseData): number {
  return house.name === 'House Mira' ? 1.15 : 1.0;
}

export function getMarketBuyModifier(house: HouseData): number {
  return house.name === 'House Mira' ? 0.85 : 1.0;
}

export function getMarketBuildingGoldModifier(house: HouseData): number {
  return house.name === 'House Mira' ? 1.25 : 1.0;
}

export function getFavorLossModifier(house: HouseData): number {
  switch (house.name) {
    case 'House Aldren':
      return 0.5;
    case 'House Sera':
      return 0.8;
    default:
      return 1.0;
  }
}

export function getStartingFavor(house: HouseData): number {
  return house.name === 'House Sera' ? 65 : 50;
}

export function getGrainSurplusConversion(house: HouseData): { threshold: number; ratio: number } | null {
  return house.name === 'House Vael' ? { threshold: 40, ratio: 3 } : null;
}

export function getLevyCostModifier(house: HouseData): number {
  return house.name === 'House Varek' ? 0.75 : 1.0;
}

export function getLevyRefusePenaltyModifier(house: HouseData): number {
  return house.name === 'House Brynn' ? 0.7 : 1.0;
}

export function getWarFavorRewardModifier(house: HouseData): number {
  switch (house.name) {
    case 'House Brynn':
      return 1.15;
    case 'House Varek':
      return 1.2;
    default:
      return 1.0;
  }
}

export function isRumorAlwaysTrue(house: HouseData): boolean {
  return house.name === 'House Crell';
}

export function canSeeNextDemand(house: HouseData): boolean {
  return house.name === 'House Crell';
}

export function getPetitionCostModifier(house: HouseData): number {
  switch (house.name) {
    case 'House Mira':
    case 'House Dorn':
      return 0.8;
    default:
      return 1.0;
  }
}

export function getPetitionSuccessModifier(house: HouseData): number {
  return house.name === 'House Crell' ? 0.25 : 0;
}

export function getKingDemandModifier(house: HouseData): number {
  return house.name === 'House Orvyn' ? 0.85 : 1.0;
}

export function hasBonusTileResource(house: HouseData): boolean {
  return house.name === 'House Dorn';
}

export function getTileChoiceCount(house: HouseData): number {
  return house.name === 'House Sera' ? 3 : 2;
}

export function getStartingTileCount(house: HouseData): number {
  return house.name === 'House Dorn' ? 27 : 25;
}
