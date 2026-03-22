/**
 * Economy system — resource types, duchy economy state, and turn processing.
 * Adapted from pixelduchy's tile-based economy to work with Voronoi regions.
 */

import type { HouseData } from './Duchy';
import type { BuildingConsumption } from './Building';
import {
  getProductionModifier,
  getSpoilageRate,
  getGrainSurplusConversion,
  getMarketBuyModifier,
  getMarketSellModifier,
} from './HouseBonus';

// ─── Resource types ──────────────────────────────────────────────────────────

export type ResourceType =
  | 'timber' | 'ore' | 'stone' | 'iron' | 'cloth' | 'gold'
  | 'grain' | 'cattle' | 'fish' | 'deer' | 'apples' | 'vegetables'
  | 'meat' | 'milk' | 'bread' | 'cheese' | 'smoked_meat' | 'pie';

export type RationLevel = 'none' | 'meager' | 'normal' | 'extra';
export type DevelopmentMode = 'command' | 'incentivize' | 'laissez_faire';

export interface Resources {
  timber: number; ore: number; stone: number; iron: number;
  cloth: number; gold: number;
  grain: number; cattle: number; fish: number; deer: number; apples: number;
  vegetables: number; meat: number; milk: number;
  bread: number; cheese: number; smoked_meat: number; pie: number;
}

export interface Population {
  total: number;
  happiness: number; // 0–100
}

export interface LaborAssignment {
  farmers: number;
  lumberjacks: number;
  miners: number;
  quarrymen: number;
  smiths: number;
  unemployed: number;
}

export interface FoodProcessing {
  cattleSlaughter: number;    // 0 to cattle count
  meatSmokingRatio: number;   // 0-100%
  dairyCheeseSplit: number;   // 0-100% (0=all milk, 100=all cheese)
  grainBakingRatio: number;   // 0-100%
  pieBakingRatio: number;     // 0-100%
  foodLaborRatio: number;     // 0-100 (stub for now)
}

export function defaultFoodProcessing(): FoodProcessing {
  return { cattleSlaughter: 0, meatSmokingRatio: 0, dairyCheeseSplit: 50, grainBakingRatio: 0, pieBakingRatio: 0, foodLaborRatio: 50 };
}

export interface FoodLedger {
  produced: number;
  eaten: number;
  spoiled: number;
}

export interface DuchyEconomy {
  resources: Resources;
  population: Population;
  laborAssignment: LaborAssignment;
  rationLevel: RationLevel;
  developmentMode: DevelopmentMode;
  foodLedger: FoodLedger;
  foodEatOrder: ResourceType[];
  foodProcessing: FoodProcessing;
  taxRate: number;         // 0–100
  kingsFavor: number;      // 0–100
  militaryStrength: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const RATION_MULTIPLIERS: Record<RationLevel, number> = {
  none: 0, meager: 0.5, normal: 1.0, extra: 1.5,
};

export const HAPPINESS_FROM_RATIONS: Record<RationLevel, number> = {
  none: -10, meager: -5, normal: 0, extra: 3,
};

export const RAW_FOOD_KEYS: ResourceType[] = ['grain', 'cattle', 'fish', 'deer', 'apples', 'vegetables'];
export const PROCESSED_FOOD_KEYS: ResourceType[] = ['meat', 'milk', 'bread', 'cheese', 'smoked_meat', 'pie'];
export const FOOD_KEYS: ResourceType[] = [...RAW_FOOD_KEYS, ...PROCESSED_FOOD_KEYS];

const RESOURCE_KEYS: ResourceType[] = ['timber', 'ore', 'stone', 'iron', 'cloth'];

export function emptyResources(): Resources {
  return {
    timber: 0, ore: 0, stone: 0, iron: 0, cloth: 0, gold: 0,
    grain: 0, cattle: 0, fish: 0, deer: 0, apples: 0,
    vegetables: 0, meat: 0, milk: 0,
    bread: 0, cheese: 0, smoked_meat: 0, pie: 0,
  };
}

export function starterResources(): Resources {
  return {
    grain: 20, timber: 15, ore: 8, stone: 0, iron: 0,
    cloth: 5, fish: 5, gold: 10,
    cattle: 0, deer: 0, apples: 0,
    vegetables: 0, meat: 0, milk: 0,
    bread: 0, cheese: 0, smoked_meat: 0, pie: 0,
  };
}

export function defaultPopulation(): Population {
  return { total: 100, happiness: 70 };
}

export function defaultLabor(): LaborAssignment {
  return { farmers: 0, lumberjacks: 0, miners: 0, quarrymen: 0, smiths: 0, unemployed: 100 };
}

export function createDuchyEconomy(startingFavor: number = 50): DuchyEconomy {
  return {
    resources: starterResources(),
    population: defaultPopulation(),
    laborAssignment: defaultLabor(),
    rationLevel: 'normal',
    developmentMode: 'laissez_faire',
    foodLedger: { produced: 0, eaten: 0, spoiled: 0 },
    foodEatOrder: [...FOOD_KEYS],
    foodProcessing: defaultFoodProcessing(),
    taxRate: 20,
    kingsFavor: startingFavor,
    militaryStrength: 10,
  };
}

// ─── Production ──────────────────────────────────────────────────────────────

/**
 * Compute per-turn resource production for a duchy based on its terrain composition.
 * This is a simplified model — buildings will refine this later.
 */
export interface TerrainCounts {
  lowland: number;
  highland: number;
  coast: number;
  water: number;
  rock: number;
  cliff: number;
  total: number;
  hasRiver: boolean;
  hasForest: boolean;
}

export function computeProduction(terrain: TerrainCounts, labor: LaborAssignment): Partial<Record<ResourceType, number>> {
  const prod: Partial<Record<ResourceType, number>> = {};

  // Base production from terrain
  prod.grain = Math.floor(terrain.lowland * 0.4);
  prod.cattle = Math.floor(terrain.lowland * 0.15);
  prod.timber = Math.floor((terrain.lowland + terrain.highland) * 0.2);
  prod.ore = Math.floor(terrain.rock * 0.5 + terrain.cliff * 0.3);
  prod.stone = Math.floor(terrain.rock * 0.3 + terrain.cliff * 0.5);
  prod.gold = Math.floor(terrain.total * 0.05) + (terrain.coast > 0 ? 1 : 0);

  if (terrain.hasRiver) {
    prod.fish = Math.floor(terrain.total * 0.1) + 2;
  }
  if (terrain.hasForest) {
    prod.timber = (prod.timber ?? 0) + 3;
    prod.deer = 1;
    prod.apples = 1;
  }

  // Labor bonuses
  prod.grain = (prod.grain ?? 0) + labor.farmers;
  prod.timber = (prod.timber ?? 0) + labor.lumberjacks;
  prod.ore = (prod.ore ?? 0) + labor.miners;
  prod.stone = (prod.stone ?? 0) + labor.quarrymen;
  prod.iron = (prod.iron ?? 0) + labor.smiths;

  return prod;
}

// ─── Processing capacity ─────────────────────────────────────────────────────

export interface ProcessingCapacity {
  smokehouse: number;
  kitchen: number;
  dairy: number;
  bakery: number;
}

export function processFoodPipeline(
  eco: DuchyEconomy,
  capacity: ProcessingCapacity,
  production: Partial<Record<ResourceType, number>>,
): void {
  const fp = eco.foodProcessing;
  const r = eco.resources;

  // 1. Cattle slaughter → meat
  const toSlaughter = Math.min(fp.cattleSlaughter, r.cattle);
  r.cattle -= toSlaughter;
  r.meat += toSlaughter;

  // 2. Fish/deer new production → meat
  const newFish = production.fish ?? 0;
  const newDeer = production.deer ?? 0;
  const fishToMeat = Math.min(newFish, r.fish);
  const deerToMeat = Math.min(newDeer, r.deer);
  r.fish -= fishToMeat;
  r.deer -= deerToMeat;
  r.meat += fishToMeat + deerToMeat;

  // 3. Meat smoking (capped by smokehouse capacity)
  const smokeCap = capacity.smokehouse * 2;
  const toSmoke = Math.min(Math.floor(r.meat * fp.meatSmokingRatio / 100), smokeCap);
  r.meat -= toSmoke;
  r.smoked_meat += toSmoke;

  // 4. Dairy: 50% of non-slaughtered cattle production → milk/cheese
  const nonSlaughteredProd = Math.max(0, (production.cattle ?? 0) - toSlaughter);
  const dairyUnits = Math.floor(nonSlaughteredProd * 0.5);
  const cheeseCap = capacity.dairy * 2;
  const cheeseUnits = Math.min(Math.floor(dairyUnits * fp.dairyCheeseSplit / 100), cheeseCap);
  const milkUnits = dairyUnits - cheeseUnits;
  r.milk += milkUnits;
  r.cheese += cheeseUnits;

  // 5. Pie: apples + grain → pie (requires Bakery, computed before bread)
  const pieCap = capacity.bakery * 2;
  const piePotential = Math.min(r.apples, r.grain);
  const pieToBake = Math.min(Math.floor(piePotential * fp.pieBakingRatio / 100), pieCap);
  r.apples -= pieToBake;
  r.grain -= pieToBake;
  r.pie += pieToBake * 2;

  // 6. Bread: grain → bread at 1:2 ratio (requires Kitchen or Bakery)
  const breadCap = (capacity.kitchen + capacity.bakery) * 2;
  const grainToBake = Math.min(Math.floor(r.grain * fp.grainBakingRatio / 100), breadCap, r.grain);
  r.grain -= grainToBake;
  r.bread += grainToBake * 2;
}

// ─── Turn processing ─────────────────────────────────────────────────────────

export function processEconomyTurn(
  economy: DuchyEconomy,
  terrain: TerrainCounts,
  house: HouseData | null = null,
  capacity?: ProcessingCapacity,
): DuchyEconomy {
  const eco = structuredClone(economy);

  // 1. Harvest resources (with house production modifiers)
  const production = computeProduction(terrain, eco.laborAssignment);
  let totalProduced = 0;
  for (const [key, amount] of Object.entries(production)) {
    const mod = house ? getProductionModifier(house, key) : 1;
    const adjusted = Math.floor((amount ?? 0) * mod);
    eco.resources[key as ResourceType] += adjusted;
    if (FOOD_KEYS.includes(key as ResourceType)) totalProduced += adjusted;
  }

  // 1b. Food processing pipeline
  if (capacity) {
    processFoodPipeline(eco, capacity, production);
  }

  // 2. Tax income
  const taxGold = Math.floor(eco.population.total * eco.taxRate * 0.005);
  eco.resources.gold += taxGold;

  // 3. Food consumption
  const eatAmount = Math.round(eco.population.total * RATION_MULTIPLIERS[eco.rationLevel]);
  let eatRemaining = eatAmount;
  let totalEaten = 0;
  for (const key of eco.foodEatOrder) {
    if (eatRemaining <= 0) break;
    const take = Math.min(eco.resources[key] ?? 0, eatRemaining);
    eco.resources[key] -= take;
    eatRemaining -= take;
    totalEaten += take;
  }

  // 4. Spoilage (house-modified rate)
  const remainingFood = FOOD_KEYS.reduce((s, k) => s + (eco.resources[k] ?? 0), 0);
  const spoilRate = house ? getSpoilageRate(house) : 0.02;
  let spoilAmount = Math.ceil(remainingFood * spoilRate);
  let totalSpoiled = 0;
  for (const key of eco.foodEatOrder) {
    if (spoilAmount <= 0) break;
    const take = Math.min(eco.resources[key] ?? 0, spoilAmount);
    eco.resources[key] -= take;
    spoilAmount -= take;
    totalSpoiled += take;
  }

  eco.foodLedger = { produced: totalProduced, eaten: totalEaten, spoiled: totalSpoiled };

  // 5. Grain surplus conversion (house bonus)
  if (house) {
    const conv = getGrainSurplusConversion(house);
    if (conv && eco.resources.grain > conv.threshold) {
      const excess = eco.resources.grain - conv.threshold;
      const goldGain = Math.floor(excess / conv.ratio);
      eco.resources.grain -= goldGain * conv.ratio;
      eco.resources.gold += goldGain;
    }
  }

  // 6. Happiness
  eco.population.happiness = Math.max(0, Math.min(100,
    eco.population.happiness
    + HAPPINESS_FROM_RATIONS[eco.rationLevel]
    - Math.floor(eco.taxRate / 25) // high taxes reduce happiness
    + (eatRemaining > 0 ? -5 : 0)  // starvation penalty
  ));

  // 7. Population growth/decline
  const immigration = eco.population.happiness > 60 ? Math.floor((eco.population.happiness - 60) / 10) : 0;
  const emigration = eco.population.happiness < 30 ? Math.floor((30 - eco.population.happiness) / 10) : 0;
  const delta = immigration - emigration;
  eco.population.total = Math.max(10, eco.population.total + delta);

  if (delta > 0) {
    eco.laborAssignment.unemployed += delta;
  } else if (delta < 0) {
    let toRemove = Math.abs(delta);
    // Remove from unemployed first
    const fromUnemployed = Math.min(toRemove, eco.laborAssignment.unemployed);
    eco.laborAssignment.unemployed -= fromUnemployed;
    toRemove -= fromUnemployed;
    // If still need to remove, scale down assigned roles
    if (toRemove > 0) {
      const roles: (keyof LaborAssignment)[] = ['farmers', 'lumberjacks', 'miners', 'quarrymen', 'smiths'];
      const totalAssigned = roles.reduce((s, r) => s + eco.laborAssignment[r], 0);
      if (totalAssigned > 0) {
        for (const role of roles) {
          const reduction = Math.ceil((eco.laborAssignment[role] / totalAssigned) * toRemove);
          eco.laborAssignment[role] = Math.max(0, eco.laborAssignment[role] - reduction);
        }
      }
    }
  }

  // Clamp labor assignments to population
  const roles: (keyof LaborAssignment)[] = ['farmers', 'lumberjacks', 'miners', 'quarrymen', 'smiths'];
  const assigned = roles.reduce((s, r) => s + eco.laborAssignment[r], 0);
  if (assigned > eco.population.total) {
    const scale = eco.population.total / assigned;
    for (const role of roles) {
      eco.laborAssignment[role] = Math.floor(eco.laborAssignment[role] * scale);
    }
    const newAssigned = roles.reduce((s, r) => s + eco.laborAssignment[r], 0);
    eco.laborAssignment.unemployed = Math.max(0, eco.population.total - newAssigned);
  } else {
    eco.laborAssignment.unemployed = Math.max(0, eco.population.total - assigned);
  }

  return eco;
}

// ─── Building processing ─────────────────────────────────────────────────────

/**
 * Consume→produce pattern for a single building tick.
 * Returns the production multiplier (0 to 1) based on available inputs.
 */
export function processBuilding(
  resources: Resources,
  consumes: BuildingConsumption | BuildingConsumption[],
  yields: { resource: ResourceType; amount: number }[],
): number {
  const consumeList = Array.isArray(consumes) ? consumes : [consumes];

  let minRatio = 1;
  for (const c of consumeList) {
    if (Array.isArray(c.resource)) {
      // Priority list: try each resource in order
      let remaining = c.amount;
      for (const res of c.resource) {
        const take = Math.min(remaining, resources[res]);
        remaining -= take;
        if (remaining <= 0) break;
      }
      const fulfilled = c.amount - remaining;
      minRatio = Math.min(minRatio, fulfilled / c.amount);
    } else {
      const available = resources[c.resource];
      minRatio = Math.min(minRatio, Math.min(available, c.amount) / c.amount);
    }
  }

  if (minRatio <= 0) return 0;

  // Actually consume
  for (const c of consumeList) {
    if (Array.isArray(c.resource)) {
      let remaining = Math.floor(c.amount * minRatio);
      for (const res of c.resource) {
        const take = Math.min(remaining, resources[res]);
        resources[res] -= take;
        remaining -= take;
        if (remaining <= 0) break;
      }
    } else {
      resources[c.resource] -= Math.floor(c.amount * minRatio);
    }
  }

  // Produce
  for (const y of yields) {
    resources[y.resource] += Math.floor(y.amount * minRatio);
  }

  return minRatio;
}

// ─── Dynamic market pricing ─────────────────────────────────────────────────

export const BASE_MARKET_PRICES: Partial<Record<ResourceType, number>> = {
  grain: 2, cattle: 4, fish: 3, apples: 2, vegetables: 2, timber: 3, ore: 5,
  stone: 4, iron: 8, cloth: 6, meat: 3, milk: 2, bread: 3, cheese: 5, smoked_meat: 6,
  pie: 7, deer: 4, gold: 1,
};

const SUPPLY_BASELINE = 20;

export function getMarketPrice(
  resource: ResourceType,
  stock: number,
  house: HouseData | null,
  isBuy: boolean,
): number {
  const base = BASE_MARKET_PRICES[resource] ?? 5;
  const supplyRatio = stock / SUPPLY_BASELINE;
  const supplyMod = Math.max(0.5, Math.min(2.0, 1.5 - supplyRatio * 0.5));
  let price = base * supplyMod;
  if (!isBuy) price *= 0.7;
  if (house) {
    if (isBuy) price *= getMarketBuyModifier(house);
    else price *= getMarketSellModifier(house);
  }
  return Math.max(1, Math.round(price));
}

// ─── Terrain counting ────────────────────────────────────────────────────────

/**
 * Count terrain types within a duchy's regions.
 */
export function countTerrain(
  regions: number[],
  terrainTypes: string[],
  hasRiver: boolean,
  hasForest: boolean,
): TerrainCounts {
  const counts: TerrainCounts = {
    lowland: 0, highland: 0, coast: 0, water: 0, rock: 0, cliff: 0,
    total: regions.length, hasRiver, hasForest,
  };

  for (const r of regions) {
    const t = terrainTypes[r];
    if (t === 'lowland') counts.lowland++;
    else if (t === 'highland') counts.highland++;
    else if (t === 'coast') counts.coast++;
    else if (t === 'water' || t === 'ocean') counts.water++;
    else if (t === 'rock') counts.rock++;
    else if (t === 'cliff') counts.cliff++;
    else counts.lowland++; // default
  }

  return counts;
}
