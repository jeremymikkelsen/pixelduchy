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
  | 'grain'
  | 'timber'
  | 'ore'
  | 'cloth'
  | 'fish'
  | 'spice'
  | 'gold';

export type BuildingType =
  | 'mill'
  | 'mine'
  | 'sawmill'
  | 'port'
  | 'barracks'
  | 'market'
  | 'church'
  | 'castle';

export type DevelopmentMode = 'command' | 'incentivize' | 'laissez_faire';

export type GamePhase = 'lobby' | 'setup' | 'active' | 'ended';

export type TurnPhase =
  | 'king_demands'
  | 'planning'
  | 'events'
  | 'resolution'
  | 'scoring';

// ─── Map / World ──────────────────────────────────────────────────────────────

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  resource: ResourceType | null;
  resourceYield: number;
  elevation: number;
  duchyId: string | null;
}

export interface WorldMap {
  width: number;
  height: number;
  tiles: Tile[][];
  seed: number;
}

// ─── Game Entities ────────────────────────────────────────────────────────────

export interface Resources {
  grain: number;
  timber: number;
  ore: number;
  cloth: number;
  fish: number;
  spice: number;
  gold: number;
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
  population: Population;
  buildings: DuchyBuilding[];
  kingsFavor: number; // 0–100
  developmentMode: DevelopmentMode;
  spyNetwork: number; // 0–100, hidden from others
  militaryStrength: number;
  turnReady: boolean;
}

// ─── King / Demands ───────────────────────────────────────────────────────────

export interface KingDemand {
  id: string;
  turnNumber: number;
  resourceType: ResourceType;
  amount: number;
  favorReward: number;
  favorPenalty: number;
  deadline: number; // turn number
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
  setSession: (session: GameSession) => void;
  setMyDuchy: (duchy: Duchy) => void;
  setAllDuchies: (duchies: Duchy[]) => void;
  setPlayers: (players: Player[]) => void;
  addEvent: (event: GameEvent) => void;
}

export interface UIStore {
  selectedTile: { x: number; y: number } | null;
  openPanel: 'economy' | 'intel' | 'military' | 'king' | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  setOpenPanel: (panel: UIStore['openPanel']) => void;
}
