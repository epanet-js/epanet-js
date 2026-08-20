# @epanet-js/map

Public, backend-agnostic map-rendering primitives. This lib is the shared vocabulary between the app's map updater and any rendering backend: it owns the `MapOperations` contract all backends implement, the `MapEngine` Mapbox wrapper they mutate, the render-facing symbology types, and the event-handler shape. It depends only on sibling libs and mapbox-gl / deck.gl — never on the app or a specific backend.

## MapOperations — the backend seam

`MapOperations` (`map-operations.ts`) is the interface that decouples *what* to render from *how*. The app's updater computes the desired map state and calls these methods; a backend implements them. The default GeoJSON backend is in the app. This lib defines the contract and ships no implementation.

- `RawData` — the per-cycle inputs a backend needs to (re)build sources: assets, render symbology, units/formatting, simulation results, selected ids.
- `ChangeFlags` — which of symbology / simulation / selection actually changed, so a backend can pick the cheapest update.
- Methods: `applyStyle`, `rebuildDataSources`, `updateDataSources`, `syncSourceEdits`, `updateEditionsVisibility`, `finalizeConsolidation`. How the updater sequences them is documented in the app's `src/map/AGENTS.md`.
- `prepare?()` — optional, and the only method called before the map is touched at all: where a backend waits on an external dependency it needs before it can render (a service worker taking control, a capability probe). Applying a style is destructive, so a backend that waits inside `applyStyle` instead makes the user watch a torn-down map for the duration — and it is the cleanest place to throw `MapBackendUnavailableError`, since nothing has been mutated yet.
- `MapBackendUnavailableError` (`errors.ts`) — a backend throws this when it can't run in the current browser (e.g. it needs a browser capability the environment doesn't provide). The app's updater catches it (matched by `name`) to fall back to the default geojson backend. The contract lives here because both the thrower (a backend) and the catcher (the app) depend on this lib.

Keep the contract minimal and backend-neutral — nothing here may assume a particular data-source type.

## MapEngine — the Mapbox wrapper

`MapEngine` (`map-engine.ts`) is a thin wrapper over a mapbox-gl `Map`, exposing the operations the app and backends use, grouped as:

- **Style** — `setStyle`, `isStyleLoaded`, `addIcons`.
- **Sources** — `setSource`, `removeSource`. `setSource` writes geojson data, so it throws `SourceTypeMismatchError` (`errors.ts`) when the name resolves to a source of another type. That means the style on the map came from a different backend than the one now driving it; only re-applying the style fixes it, so the engine refuses rather than writing. Kept typed because the mapbox failure is otherwise a bare `TypeError` naming neither the source nor the mismatch.
- **Feature state** (hide/show individual features) — `hideFeature`/`showFeature` (+ bulk variants), `clearFeatureState`, `getFeatureState`, `isFeatureHidden`.
- **Layers** — `addLayer`, `showLayers`/`hideLayers`, `setLayerFilter`, `setLayerPaintRule`, `setLayerMinZoom`.
- **deck.gl overlay** — it holds one `MapboxOverlay` (`@deck.gl/mapbox`); `setOverlay(layers)` swaps the deck layers, `pickOverlayObjects` hit-tests them, and `suspend`/`resumeOverlayStyleReactions` guard the overlay across a style rebuild.
- **View + query** — `getZoom`, `getPrecision`, `getBounds`/`setBounds`, `queryRenderedFeatures`, `searchNearbyRenderedFeatures`.
- **`onNextIdle`** — the settle primitive (below).

Design rule: **`MapEngine` stays backend-agnostic.** It exposes only generic source, layer, and overlay operations and makes no assumption about how a backend turns map state into pixels; anything specific to one rendering strategy lives in that backend, not here.

### `onNextIdle` — the settle primitive

`onNextIdle(cb)` fires once when the map next reaches `idle`, reporting `settledCleanly`. It is **single-pending** (a new arm replaces the old), has a **backstop timeout** so it always fires even if `idle` never comes, and reports `settledCleanly = false` if the map was moving or disturbed during the wait (so a duration measured across it can't be trusted). The app's loading indicator and playback-timing "settling" are built entirely on this one call — see the app's `src/map/AGENTS.md`.

## Symbology (render-facing) and types

- `symbology/` — the render-facing styling vocabulary a backend consumes: `RenderSymbology` (the resolved per-node / per-link color + label rules that `RawData` carries), `RenderColorRule`, `NodeSizeConfig`, and `colorFor(rule, value)` / `strokeColorFor` that resolve a value to a color. The app's higher-level symbology (ranges, editing UI) sits above this; the lib holds only what rendering needs.
- `types.ts` — `MapHandlers`, the event-handler shape the app's canvas implements and feeds raw mapbox events into, plus the `ClickEvent` / `MoveEvent` aliases.
- `custom-map-control.ts` — a small custom mapbox `IControl`.

## Rules

- Keep the lib **backend-agnostic**: no assumption of data source type anywhere in `MapEngine` or `MapOperations`.
- Keep `MapEngine` free of backend-specific rendering plumbing — only generic source/layer/overlay operations belong here; anything tied to one rendering strategy lives in that backend.
- No imports from the app or a specific backend; this is a leaf primitives lib (sibling libs + mapbox-gl / deck.gl only).
- Prefer additive changes; don't remove or alter the public surface beyond the ask.
- Use `pnpm test`; don't `git add` / commit automatically.
