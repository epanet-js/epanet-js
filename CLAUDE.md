# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev               # Start Next.js dev server
pnpm build             # Production build
pnpm test              # Run all tests (vitest)
pnpm test:watch        # Tests in watch mode
pnpm test -- src/path/to/file.test.ts   # Run a single test file
pnpm lint              # ESLint
pnpm lint:fix          # ESLint with auto-fix
pnpm check-types       # TypeScript type check (no emit)
pnpm check-types:watch # Type check in watch mode
```

## Architecture

This is a **Next.js 14** web app for designing and simulating water distribution networks (EPANET). The stack: React 18, TypeScript, Jotai (state), Mapbox GL + Deck.gl (map), Radix UI, Tailwind CSS, ECharts (charts), Replicache (local-first sync), Clerk (auth), PostHog (feature flags), Sentry.

### App Shell

`src/components/epanet-app.tsx` is the root. It renders:
- `MenuBar` → `Toolbar` → map area (`MapCanvas`) → side panels → `BottomPanel`
- All dialogs are mounted here from a single `<Dialogs />` component
- Feature flags from PostHog wrap the app via `FeatureFlagsProvider`

### State Management (Jotai)

All global state lives in `src/state/`. Key atoms:

| Atom | File | Purpose |
|---|---|---|
| `modeAtom` | `mode.ts` | Current toolbar/interaction mode (`Mode` enum) |
| `dialogAtom` | `dialog.ts` | Which dialog is open (discriminated union or `null`) |
| `stagingModelAtom` | `hydraulic-model.ts` | The editable hydraulic model |
| `baseModelAtom` | `hydraulic-model.ts` | The committed/saved model |
| `selectionAtom` | `selection.ts` | Currently selected assets |
| `splitsAtom` | `layout.ts` | Panel layout sizes and open/closed state |
| `simulationStepAtom` | `simulation.ts` | Current EPS time step for playback |

`src/state/index.ts` is a barrel export. Access atoms with `useAtom` / `useAtomValue` / `useSetAtom` from Jotai.

### Hydraulic Model

`HydraulicModel` (defined in `src/hydraulic-model/`) is the core data structure:
- `assets` — map of all network assets (junctions, pipes, pumps, valves, tanks, reservoirs)
- `topology` — `Topology` class (ngraph.graph under the hood) for connectivity queries: `getLinks(nodeId)`, `getNodes(linkId)`
- `assetIndex` — spatial index for proximity queries

**Mutations**: pure functions in `src/hydraulic-model/model-operations/` that return a `ModelMoment` (reversible change). Commands apply moments via `useModelTransaction()` → `transact(moment)`.

**Asset types**: `src/hydraulic-model/asset-types/` — `Junction`, `Pipe`, `Pump`, `Valve`, `Tank`, `Reservoir`. All nodes have `elevation`; all links have `length` (hydraulic length in meters).

### Map System

`src/map/map-canvas.tsx` hosts Mapbox GL with Deck.gl overlay.

**Mode handlers** (`src/map/mode-handlers/`) — each returns click/move handlers for a specific `Mode`:
- `useNoneHandlers` — default select/click
- `useDrawNodeHandlers`, `useDrawLinkHandlers`, `useAreaSelectionHandlers`, `useTraceSelectHandlers`

Active handler is dispatched in `useModeHandlers()` based on `modeAtom`. To add a new interaction mode: add entry to `Mode` enum → add to `MODE_INFO` → write a handler hook → wire in `useModeHandlers`.

### Mode System

`src/state/mode.ts` defines the `Mode` enum (16 modes: NONE, DRAW_JUNCTION, BOUNDARY_TRACE_SELECT, etc.). Changing mode:
```ts
const setMode = useSetAtom(modeAtom);
setMode({ mode: Mode.SOME_MODE });
```

### Dialog System

All dialogs are lazy-loaded via `next/dynamic` and registered in `src/dialogs/index.tsx` using `ts-pattern` match on `dialogAtom`.

To add a dialog:
1. Create component in `src/dialogs/`
2. Add a new type to the discriminated union in `src/state/dialog.ts`
3. Add a `match` case in `src/dialogs/index.tsx`

Opening a dialog: `setDialogState({ type: "myDialog", ...props })` — closing: `setDialogState(null)`.

### Toolbar & Commands

`src/toolbar/` — toolbar UI. `src/commands/` — 52+ command hooks (`useRunSimulation`, `useDeleteSelection`, etc.). Commands use `useModelTransaction()` to apply model changes and `useUserTracking()` for analytics.

### Simulation

`src/simulation/` — EPANET simulation engine integration. Results exposed via `ResultsReader` interface (`src/simulation/results-reader.ts`): `getJunction(id)` → `{ pressure, head, demand, ... }`, `getPipe(id)` → `{ flow, velocity, headloss, ... }`. EPS results live in `src/simulation/epanet/eps-results-reader.ts`.

### Charts

ECharts (`echarts` + `echarts-for-react`) is the charting library. See `src/panels/asset-panel/quick-graph/quick-graph-chart.tsx` for existing usage patterns.

### Feature Flags

```ts
const isOn = useFeatureFlag("FLAG_NAME"); // boolean
```
Backed by PostHog in production; URL param `?FLAG_NAME=true` works locally for testing.

### Panels Layout

`src/panels/index.tsx` orchestrates left panel (network review), right side panel (asset properties), and bottom panel. `splitsAtom` controls sizes. `showPanelBottomAtom` toggles the bottom panel visibility.
