// ─── Enums ────────────────────────────────────────────────────────────────────

export type TileType =
  | 'ocean'
  | 'coast'
  | 'plains'
  | 'forest'
  | 'mountain'
  | 'wetland'
  | 'desert';

export type ResourceType =
  // Economic goods
  | 'timber'
  | 'ore'
  | 'cloth'
  | 'spice'
  | 'gold'
  // Food — raw
  | 'grain'
  | 'cattle'
  | 'fish'
  | 'deer'
  | 'apples'
  // Food — processed
  | 'bread'
  | 'cheese'
  | 'smoked_meat'
  | 'pie';    // prestige good: consumed for happiness/favor, not counted as nutrition

export type BuildingType =
  // Food production
  | 'field'
  | 'pasture'
  | 'orchard'
  | 'fishery'
  // Food processing
  | 'smokehouse'
  | 'kitchen'
  // Economic / existing
  | 'mill'
  | 'mine'
  | 'sawmill'
  | 'port'
  | 'barracks'
  | 'market'
  | 'church'
  | 'castle';

/** Food distribution policy — governs how the duchy allocates food to the population. */
export type DevelopmentMode = 'command' | 'incentivize' | 'laissez_faire';

export type GamePhase = 'lobby' | 'setup' | 'active' | 'ended';

export type TurnPhase =
  | 'king_demands'
  | 'planning'
  | 'events'
  | 'resolution'
  | 'scoring';

/** Four seasons within each in-game year. */
export type Season = 'spring' | 'summer' | 'fall' | 'winter';

// ─── Map / World ──────────────────────────────────────────────────────────────

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  resource: ResourceType | null;
  resourceYield: number;
  elevation: number;
  duchyId: string | null;
  /**
   * Max deer (or fish for river tiles) that can be harvested per season
   * before the population starts to decline. Only set for forest and river tiles.
   */
  wildlifeCapacity: number;
  /**
   * Current wildlife population. Depletes when hunted/fished; regenerates each
   * season toward wildlifeCapacity. When current < capacity the resourceYield
   * is scaled down proportionally.
   */
  wildlifeCurrent: number;
}

export type RiverPath = Array<{ x: number; y: number }>;

export interface WorldMap {
  width: number;
  height: number;
  tiles: Tile[][];
  seed: number;
  rivers?: RiverPath[]; // absent in older persisted sessions — treat as []
}

// ─── Game Entities ────────────────────────────────────────────────────────────

export interface Resources {
  // Economic goods
  timber: number;
  ore: number;
  cloth: number;
  spice: number;
  gold: number;
  // Food — raw
  grain: number;
  cattle: number;
  fish: number;
  deer: number;
  apples: number;
  // Food — processed
  bread: number;
  cheese: number;
  smoked_meat: number;
  pie: number; // prestige good
}

/**
 * Tracks how many seasons each semi-perishable food has been sitting in
 * storage. Used to apply spoilage at the end of each season.
 *
 *   apples / bread  → expire after 2 seasons
 *   cheese / smoked_meat → expire after 8 seasons (2 years)
 *   fish / deer     → fully perishable: zeroed at season end (no age needed)
 *   grain / cattle  → do not spoil
 */
export interface FoodAges {
  apples: number;
  bread: number;
  cheese: number;
  smoked_meat: number;
}

export interface Population {
  total: number;
  farmers: number;
  artisans: number;
  merchants: number;
  soldiers: number;
  happiness: number; // 0–100
}

export interface DuchyBuilding {
  id: string;
  type: BuildingType;
  tileX: number;
  tileY: number;
  level: number;
}

export interface Duchy {
  id: string;
  gameId: string;
  playerId: string;
  name: string;
  color: string;
  tiles: Array<{ x: number; y: number }>;
  resources: Resources;
  foodAges: FoodAges;
  population: Population;
  buildings: DuchyBuilding[];
  kingsFavor: number;        // 0–100
  /**
   * How the duchy distributes food to its population.
   *   command       – player assigns allotments; more corruption, lower yields
   *   incentivize   – player sets prices; people buy as they desire
   *   laissez_faire – market sets its own price; people shop freely
   */
  developmentMode: DevelopmentMode;
  spyNetwork: number;        // 0–100
  militaryStrength: number;
  turnReady: boolean;
}

// ─── King / Demands ───────────────────────────────────────────────────────────

export interface KingDemand {
  id: string;
  /** Turn on which the demand was issued (always a Spring turn). */
  issuedTurn: number;
  /** Turn by which the tribute must be paid (the Fall turn of the same year). */
  deadlineTurn: number;
  resourceType: ResourceType;
  amount: number;
  favorReward: number;
  favorPenalty: number;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventScope = 'global' | 'duchy' | 'pair';

export interface GameEvent {
  id: string;
  scope: EventScope;
  title: string;
  description: string;
  options: EventOption[];
}

export interface EventOption {
  label: string;
  effects: Partial<{
    resources: Partial<Resources>;
    population: Partial<Population>;
    kingsFavor: number;
    militaryStrength: number;
  }>;
}

// ─── Players / Game ───────────────────────────────────────────────────────────

export interface Player {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface GameSession {
  id: string;
  createdBy: string;
  phase: GamePhase;
  turnPhase: TurnPhase;
  turnNumber: number;
  maxTurns: number;
  playerCount: number;
  map: WorldMap;
  currentKingDemand: KingDemand | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Store Slices ─────────────────────────────────────────────────────────────

export interface GameStore {
  session: GameSession | null;
  myDuchy: Duchy | null;
  allDuchies: Duchy[];
  players: Player[];
  events: GameEvent[];
  gameOver: boolean;
  victory: boolean;
  setSession: (session: GameSession) => void;
  setMyDuchy: (duchy: Duchy) => void;
  setAllDuchies: (duchies: Duchy[]) => void;
  setPlayers: (players: Player[]) => void;
  addEvent: (event: GameEvent) => void;
  initLocalGame: () => void;
  endTurn: () => void;
  placeBuilding: (type: BuildingType, x: number, y: number) => boolean;
  fulfillDemand: () => void;
  refuseDemand: () => void;
  setDistributionMode: (mode: DevelopmentMode) => void;
  restartGame: () => void;
}

export interface UIStore {
  selectedTile: { x: number; y: number } | null;
  openPanel: 'economy' | 'intel' | 'military' | 'king' | 'food' | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  setOpenPanel: (panel: UIStore['openPanel']) => void;
}
