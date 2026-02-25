# Pixelduchy: AI Handoff Summary

This document is a compact technical map of the codebase so an AI assistant can add features without loading every file.

## 1) What This Project Is

Pixelduchy is a single-player strategy prototype:

- React renders menus, HUD, modals, and panels.
- Phaser renders and controls the world map (camera, dragging, selection).
- Zustand stores game/session/UI state.
- Supabase wiring exists but current gameplay loop runs locally/offline.

Core gameplay loop:

1. Start local game and generate procedural world.
2. Claim initial territory and place starter buildings.
3. End turn to harvest resources.
4. Every 5 turns: King demand modal (fulfill or refuse).
5. Every 3 turns without demand: optional King tile grant.
6. Win by surviving `maxTurns`, lose if favor reaches `<= 0`.

## 2) Tech Stack

- Vite + React 19 + TypeScript (strict)
- Phaser 3.90
- Zustand 5
- Optional Supabase client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

Entry points:

- `src/main.tsx`
- `src/App.tsx`

## 3) Architecture Overview

### UI and Rendering Split

- React owns all interface panels and modal flow.
- Phaser `MapScene` owns map rendering and pointer/camera interaction.
- React and Phaser communicate through Zustand stores (no direct prop bridge).

### State Stores

- `src/store/gameStore.ts`
  - Main game state and commands (`initLocalGame`, `endTurn`, `placeBuilding`, market actions, king actions).
  - Source of truth for `session`, `myDuchy`, `allDuchies`, win/lose flags.
- `src/store/uiStore.ts`
  - Transient UI state (`selectedTile`, `openPanel`).

### Type Contracts

- `src/types/index.ts`
  - Shared domain model (`WorldMap`, `Tile`, `Duchy`, `Resources`, `GameSession`, `KingDemand`, etc.).
  - Treat this as the schema authority before feature changes.

## 4) Gameplay Systems

### Turn and Building Rules

- `src/game/systems/turnEngine.ts`
  - Building costs/yields/favor tables.
  - Resource harvest from owned tiles + buildings.
  - King demand generation.
  - Tile-offer candidate search (adjacent unclaimed tile).

### Market Rules

- `src/game/systems/marketEngine.ts`
  - Base prices and dynamic buy/sell calculations based on current stock.
  - `TRADEABLE_RESOURCES` and display emoji map.
  - Known behavior: arbitrage is currently possible and intentionally deferred for a future economy update.

### World Generation

- `src/game/procgen/worldgen.ts`
  - Seeded noise-based map generation, biome classification, resource assignment.
  - Calls river generation.
- `src/game/procgen/rivergen.ts`
  - Downhill river path generation from high-elevation candidates.
- `src/game/procgen/tileRenderer.ts`
  - Procedural tile textures for seasons/variants.
- `src/game/procgen/buildingRenderer.ts`
  - Procedural building sprite textures.

## 5) Scenes and UI Composition

### Phaser Scenes

- `src/game/scenes/BootScene.ts`
  - Prepares tile/building textures, then starts map scene.
- `src/game/scenes/MapScene.ts`
  - Renders terrain/overlays, updates on store changes, handles camera drag/zoom and tile selection.
- `src/game/scenes/UIScene.ts`
  - Placeholder for future Phaser-native UI overlays.

### React Shell

- `src/App.tsx`
  - Always mounts Phaser canvas container.
  - Shows `MainMenu` when no session.
  - In game: HUD + tile panel + king modals + result overlay.

Primary React components:

- HUD: `src/components/hud/GameHUD.tsx`
- Menu: `src/components/menus/MainMenu.tsx`
- Tile/build/market panel: `src/components/panels/TilePanel.tsx`, `src/components/panels/MarketPanel.tsx`
- King interactions: `src/components/panels/KingDemandModal.tsx`, `src/components/panels/KingTileOfferModal.tsx`
- End state: `src/components/overlays/GameResultOverlay.tsx`

## 6) Multiplayer/Supabase Status

Files exist:

- `src/lib/supabase/client.ts`
- `src/lib/supabase/queries.ts`
- `supabase/migrations/0001_initial_schema.sql`

Current status:

- Local/offline game loop is the active runtime path.
- Supabase integration is partial and not wired into the main React flow yet.
- If enabling multiplayer, verify field-name mapping between TS models (camelCase) and SQL columns (snake_case).

## 7) Feature Work Playbook (For AI Assistants)

### Add a New Building

1. Add `BuildingType` union value in `src/types/index.ts`.
2. Add cost/yield/favor/label/description in `src/game/systems/turnEngine.ts`.
3. Add renderer implementation + registration in `src/game/procgen/buildingRenderer.ts`.
4. Expose in `BUILDABLE` list in `src/components/panels/TilePanel.tsx` if player-buildable.

### Add a New Resource

1. Add to `ResourceType` and `Resources` in `src/types/index.ts`.
2. Update starter resources in `src/store/gameStore.ts`.
3. Add market base price + tradable list + emoji in `src/game/systems/marketEngine.ts` (if tradable).
4. Optionally wire generation in `src/game/procgen/worldgen.ts`.

### Change Turn Cadence / King Mechanics

- Modify turn gating and event schedule in `src/store/gameStore.ts`.
- Modify demand payload generation in `src/game/systems/turnEngine.ts`.

### Change Map Look/Feel

- Biome/resource logic: `src/game/procgen/worldgen.ts`
- River shape density: `src/game/procgen/rivergen.ts`
- Visual styling/layers: `src/game/scenes/MapScene.ts` + `src/game/procgen/*Renderer.ts`

## 8) Build and Run

```bash
npm ci
npm run dev
```

Other scripts:

- `npm run build`
- `npm run lint`
- `npm run preview`

## 9) Current Quality Notes

- Build passes (`npm run build`).
- Lint currently reports several strict TypeScript ESLint issues (`any` usage + unused params/vars).
- These lint failures are known technical debt and do not block local runtime.
