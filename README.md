# Pixeldraw

Procedurally generated pixel-art terrain maps built with TypeScript and Phaser 3.

[Live Demo](https://pixeldraw-livid.vercel.app/) — press SPACE to regenerate

## Quick Start

```bash
npm install
npx vite --port 3000
```

## Architecture

### Generation Pipeline

```
Seed
 └─ TopographyGenerator  — Voronoi mesh + elevation + terrain classification
     └─ HydrologyGenerator  — precipitation → flow → rivers → soil moisture
         ├─ GroundRenderer   — two-phase pixel art terrain rendering
         ├─ TreeRenderer     — procedural tree placement + sprite stamping
         └─ RiverAnimator    — pre-computed river pixels, per-frame animation
              └─ MapScene    — Phaser scene: display, input, overlays
```

### Data Layer (Voronoi mesh)

**TopographyGenerator** — Poisson-disk samples the canvas, builds a Delaunay/Voronoi dual mesh (`DualMesh`), computes per-region elevation via multi-octave simplex noise + island mask, classifies terrain by elevation thresholds. Exposes `elevationAt(x, y, noise)` for per-pixel elevation lookups by downstream renderers.

**HydrologyGenerator** — Simulates terrain hydrology on the Voronoi mesh:
1. Precipitation with westerly-wind rain shadow + orographic uplift
2. Sink filling via priority flood
3. Flow direction (steepest descent) + flow accumulation
4. River network extraction (threshold-based, head-traced)
5. Soil moisture (weighted blend of precipitation, river proximity, drainage)

### Render Layer (pixel art)

**GroundRenderer** — Two-phase pixel renderer (1024x1024):
- Phase 1A: Per-pixel region lookup (`SpatialGrid`) + elevation from noise
- Phase 1B: Slope via central differences (dE/dx, dE/dy)
- Phase 1C: Border distance field (chamfer transform) + neighbor terrain tracking
- Phase 2: Pixel shader — palette lookup (detail noise) + moisture tinting + directional lighting (5-step quantized) + Bayer 4x4 border dithering

**TreeRenderer** — Poisson-disk candidates, filtered by terrain/elevation/moisture, density-modulated. Sorted by Y for painter's algorithm. Shadow pass (elliptical darkening) then sprite pass (directional canopy shading). Deciduous vs conifer blended by elevation.

**RiverAnimator** — Pre-computes river pixel positions + metadata (flow direction, elevation, width tier, phase). Per-frame: sine wave animation, rapids foam sparkles at high elevation, rocks and logs as static decorations.

### Shared Utilities

**utils.ts** — `mulberry32` PRNG, `TerrainType`, `isWater()`, shared constants (`MAP_SCALE`, `RIVER_THRESHOLD`, `LIGHT_DIR_X/Y`)

**SpatialGrid** — Accelerated nearest-Voronoi-region lookup using a 40px uniform grid. O(R) construction, O(1) amortised queries.

**TerrainPalettes** — 5-shade terrain palettes (dark→light), `BAYER_4X4` dither matrix, `packABGR()` / `applyBrightness()` color utilities.

### Scene Layer

**MapScene** — Phaser scene that orchestrates generation, manages the canvas texture + sprite, handles input (scroll, zoom, regenerate), runs the river animation loop, manages debug overlays (moisture/elevation), and highlights the hovered Voronoi region.

## Terrain Types & Elevation Thresholds

| Type | Elevation Range | Description |
|------|----------------|-------------|
| ocean | < 0.25 | Deep water |
| water | 0.25 – 0.32 | Shallow water |
| coast | 0.32 – 0.38 | Beach/shoreline |
| lowland | 0.38 – 0.55 | Grassland/forest floor |
| highland | 0.55 – 0.70 | Dense forest/hills |
| rock | 0.70 – 0.82 | Rocky terrain |
| cliff | >= 0.82 | Mountain peaks |

## House Architectural Styles

Each of the 9 houses has a unique visual identity — distinct manor, cottage, and production hut sprites with custom color palettes, crop types, and cattle breeds.

| House | Culture | Roof | Walls | Unique Feature | Crops | Cattle |
|-------|---------|------|-------|----------------|-------|--------|
| Aldren | Anglo-Saxon | Golden thatch | Dark oak timber | Steep A-frame longhouse | Wheat | Brown cattle |
| Mira | Venetian | Terracotta tile | White plaster | Two-story palazzo, arched windows | Grapevine | Spotted white cattle |
| Sera | Burgundian | Purple-grey slate | Cream stone | Corner turret with finial | Herbs | White cattle |
| Dorn | Norse | Green sod/turf | Red-stained pine | Wide longhouse, dual chimneys | Root vegetables | Shaggy highland cattle |
| Crell | Byzantine | Blue ceramic tile | Dark stone/brick | Watchtower extension | Barley | Grey cattle |
| Vael | Celtic/Druidic | Living moss-green | Tan wattle-daub | Rounded organic silhouette | Mixed gardens | Red cattle |
| Orvyn | Hanseatic | Dark charcoal slate | White plaster + dark beams | Half-timber Fachwerk pattern | Rye | Holstein cattle |
| Varek | Roman | Crimson tile | Grey stone | Crenellated battlements | Wheat | War horses |
| Brynn | Scottish Highland | Weathered slate | Rough dry-stone | Conical broch tower | Oats | Highland cattle |

## Building Sprites

Each building type has a unique 9×10 pixel-art sprite rendered by `PlacedBuildingRenderer`. Roof color is tinted by category; shape distinguishes the type.

| Type | Category | Visual |
|------|----------|--------|
| field | food_production | Crop rows with fence rail |
| pasture | food_production | Fenced enclosure with grass tufts |
| orchard | food_production | Tree canopy clusters on trunks |
| fishery | food_production | Small hut with pier + water |
| smokehouse | food_processing | Building with tall chimney + smoke |
| kitchen | food_processing | Wide building with chimney |
| dairy | food_processing | Barn-shaped roof |
| bakery | food_processing | Building with chimney puff |
| woodcutter | resource_production | Small hut with log pile |
| sawmill | resource_production | Building with stacked lumber |
| mill | resource_production | Tall windmill with arms |
| mine | resource_production | Cave entrance in hillside |
| quarry | resource_production | Open pit with stone blocks |
| bog_mine | resource_production | Low structure with dark pool |
| smelter | processing | Building with large chimney stack |
| weaver | processing | Building with fabric accent |
| market | economic | Open stall with awning |
| port | economic | Wide warehouse on pier stilts |
| barracks | military | Fortified with battlements |
| church | social | Tall steeple with cross |
| castle | social | Twin towers with flags |
| tavern | social | Building with hanging sign |
| house | residential | Generic residential (fallback) |

## Key Technical Details

- **Resolution**: 1024x1024 pixels rasterized, displayed at 2048x2048 world units with `pixelArt: true`
- **Pixel format**: ABGR Uint32 (little-endian ImageData compatibility)
- **Noise seeds**: elevation `seed ^ 0xdeadbeef`, detail `seed ^ 0xcafebabe`, hydrology `seed ^ 0xf100d`
- **Light direction**: upper-left (-0.707, -0.707), 5-step quantized shading
- **River threshold**: flow accumulation >= 25 to form visible river
- **Tree placement**: Poisson-disk (4-12px spacing), filtered by terrain/moisture/elevation

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Scroll map |
| +/- | Zoom in/out |
| SPACE | Regenerate with new seed |
| 9 | Toggle elevation overlay |
| 0 | Toggle moisture overlay |

## File Map

```
src/
  main.ts                           — Phaser game bootstrap (1024x1024, WebGL)
  scenes/
    MapScene.ts                      — Main scene: generation + display + input
  generators/
    utils.ts                         — Shared PRNG, types, constants
    SpatialGrid.ts                   — Nearest-region lookup acceleration
    DualMesh.ts                      — Delaunay/Voronoi dual mesh
    TopographyGenerator.ts           — Voronoi mesh + elevation + terrain
    HydrologyGenerator.ts            — Precipitation, flow, rivers, moisture
    GroundRenderer.ts                — Two-phase pixel art terrain renderer
    TreeRenderer.ts                  — Procedural tree placement + rendering
    RiverAnimator.ts                 — Animated river pixels (waves, foam, rocks)
    TerrainPalettes.ts               — Color palettes + dither utilities
  types/
    modules.d.ts                     — Type declarations for delaunator, poisson-disk
```

## Dependencies

- **Phaser 3.88** — game framework (WebGL rendering, input, camera)
- **delaunator** — Delaunay triangulation
- **fast-2d-poisson-disk-sampling** — spatial sampling for region centres + tree placement
- **simplex-noise** — multi-octave elevation + detail noise

## Future Work

- Water rendering (waves, shore foam, depth shading)
- Ground details (flowers, small rocks, grass)
- Rock outcrops / cliff faces
- Paths / roads
- River improvements (wider deltas, branching)
