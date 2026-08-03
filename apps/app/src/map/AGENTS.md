# Map Architecture

The map renders hydraulic networks that can reach 1M+ features, so the constraint behind every decision here is that we can never re-process the whole network on a routine edit or selection. The network is rendered with Mapbox GL JS; customer points, which are far more numerous, use deck.gl overlays on the same map. All map state is applied by a single updater (`state-updates.ts`) — nothing mutates the map outside it.

## The layer stack

Everything drawn falls into four bands, painted bottom to top so the network is never hidden by the basemap and interactive feedback is never hidden by the network.

- **Base map** — basemap (satellite or vector base styles) and user GIS layers (shapefiles, GeoJSON, DXF). Contextual, drawn first.
- **Network** — the model and its context: zones, network geometry (Mapbox layers for pipes, junctions, and asset icons, each from both the consolidated and editions states with selection merged in), and the deck.gl customer-point overlays. The only band with the two-state structure.
- **Editing previews** — transient visuals from the ephemeral state: drawing and move previews, the selection rubber-band, the HGL profile tool, highlight markers. Never committed; drawn above the network so feedback always reads on top.
- **Generic overlays** — standalone data overlays outside the network model, such as elevations.

Rationale: distinct bands keep lifecycles independent — basemap changes on style choices, network on edits, previews per interaction, overlays on their own toggles — so a change in one never redraws another, and the fixed z-order keeps feedback above the data it acts on.

## Two states: consolidated and editions

The network is kept in two states. **Consolidated** is a static snapshot of the whole network, rebuilt only at sync points (an import, or an explicit consolidation). **Editions** holds only what changed since the last consolidation and is the only thing that updates on a routine edit, drawn on top of consolidated.

Rationale: rebuilding the whole snapshot scales with network size, so doing it per edit would make large networks unusable. Keeping edits in a small separate state means a normal edit rebuilds only a handful of features. At a sync point the editions fold back into the consolidated snapshot and the editions state is emptied — that is what consolidation means.

This split applies to every data category, not just geometry: features, icons, and selection each keep independent consolidated and editions state. That is the key decision. Icons and selection used to be single whole-model representations regenerated as a unit, which tied their cost to the whole network and let them drift out of step with the geometry; giving each category the same structure keeps them independent and consistent. (Implemented as `main-features`/`delta-features` with parallel `icons`/`delta-icons`.)

## Symbology: how features are styled

Symbology is the spec for how network features look: a color rule and a label rule each for nodes and links, plus separate specs for customer points and zones. A color rule maps a chosen property — a static attribute (diameter, elevation) or a simulation result (pressure, flow, velocity, headloss) — through value ranges to colors; a label rule picks which property to print by each feature.

Decision: symbology is resolved into per-feature values when the source is built, not evaluated live. A rule change rebuilds the consolidated snapshot so every feature carries its computed `color` and `label`. Rationale: a live Mapbox expression over raw properties would push styling work into every frame and force every feature to carry all the raw properties the expression reads; baking the resolved values into feature data keeps rendering cheap, uses less memory (each feature carries only its final `color` and `label`), and lets the same two-state machinery carry styling. The exception is default colors (no rule), applied as Mapbox paint expressions on the layers — which is also where selection merges in, overriding only a feature's color or sprite. Directional arrows on links appear only when the link color rule is a directional result (flow, velocity, headloss).

## Selection is a property, not a separate state

Selection is a `selected` property carried on the same data as the geometry (consolidated and editions); layers change color or sprite from it. There is no separate selection source.

Rationale: we used to keep selection in a dedicated source, but that source can grow to the full size of the network (a select-all), and a second near-whole-network representation is very costly in memory. Per-feature selection flags don't scale either — Mapbox feature state applied to that many features degrades the map badly. A property on data we already maintain means a selection change only restyles existing features.

### An overlay, not a hide-and-replace

A selected-but-unedited asset stays rendered by the consolidated snapshot; the editions layers on top paint the selection over it. We don't hide it in the consolidated snapshot to redraw it selected: hiding takes effect immediately but the selected redraw is async (the data reprocess is async), so hide-then-redraw makes the asset vanish for a few frames — a selection flicker. Only genuinely **edited** assets are hidden in the consolidated snapshot, since only their geometry is stale.

### Large selections fold into the consolidated snapshot

Small selections ride editions, overlaid on consolidated. Above a fixed threshold the selection is baked directly into the consolidated snapshot instead. Rationale: an editions overlay draws each selected asset twice (plain in consolidated, selected in editions) — fine for a few assets, wasteful for very large selections where editions would approach the whole network. Past the threshold it's cheaper to re-encode the consolidated snapshot once with selection baked in. The threshold is a fixed count, not a fraction.

Crossing the threshold is a full consolidation, not just a selection bake: the consolidated snapshot is rebuilt from the current model — folding in every pending edit — and the editions state is emptied. So once baked, edited-and-selected assets live in the consolidated snapshot too. Edits made afterwards re-enter editions and still render selected, because the `selected` property is always stamped from the full selection set wherever an asset is drawn.

## Editing in progress: ephemeral state

While an interaction is in progress (drawing, dragging), the affected geometry shows from a separate **ephemeral** state at its live position and isn't committed until the interaction completes; on cancel it's discarded.

An actively-edited asset is excluded from editions for the duration of the gesture, even if selected. Rationale: it's already shown live by ephemeral; if it also sat in editions with its old committed geometry, then on drop — when the preview clears — the stale editions geometry would flash for a frame before editions reprocessed. Excluding it means editions holds only committed edits, so on drop the asset enters editions fresh. The editions state is recomputed only when the set of in-progress targets changes (gesture start and end), not per mouse-move, so a drag doesn't rebuild editions each frame.

Accepted residual: on drop the preview clears immediately while the new editions geometry is still processing, so for ~1 frame the asset is on no layer — a faint blank, no stale flash. Closing it would require the updater to listen for a map "data ready" signal, coupling it to render events; deliberately rejected. If it must be closed, the clean fix is to drive the live drag from editions itself, not an event listener.

## Interaction: modes, handlers, adaptive precision

User interaction is organized as **modes** — draw junction/pipe/valve, rectangular/polygonal/freehand selection, trace-select, HGL profile, connect customer points, and so on. Exactly one mode is active; each supplies a set of event handlers (click, move, down, up, double, touch, keydown) that the map canvas dispatches the raw Mapbox events to, plus an `exit` handler for teardown. Move is throttled.

Rationale: one handler set active at a time keeps interaction logic isolated per mode instead of a monolithic event switch, and a uniform handler shape lets the canvas stay a thin dispatcher.

**Adaptive precision**: coordinates captured from a user gesture are rounded to a decimal precision chosen from the current zoom, such that the rounding grid is about one pixel on screen. Rationale: storing more precision than the user can see at that zoom is noise — it bloats geometry and creates spurious diffs. Matching stored precision to visible precision keeps coordinates clean with no loss the user could perceive.

## Customer points: deck.gl overlays

Customer points render through deck.gl overlays layered onto the Mapbox map rather than through the network's sources: a stable main overlay plus a light ephemeral overlay for hover and selection highlighting. Rationale: they reach 1M+ per network — orders of magnitude beyond hydraulic assets — and need GPU-scale point rendering and zoom-based level of detail that the source/layer path isn't suited to. Splitting the stable set from the highlight set means hovering doesn't rebuild the full overlay, and selection restyles it in place.

## One serialized, coalescing updater

All map mutations go through a single updater that never runs two cycles concurrently and coalesces rapid changes into one apply against the newest state.

- **No concurrency.** A style rebuild is multi-step and async; a second cycle interleaving would reset the style's loaded state mid-mutation and throw. Serializing removes that race.
- **Coalescing.** Under rapid input (dragging, playback) changes arrive faster than the map applies them. Instead of one apply per change, changes arriving mid-cycle mark it dirty; when it finishes it re-runs once against the latest state, skipping every intermediate one. Safe because each change is detected by identity, so diffing newest against last-applied equals replaying every skipped diff — and a value that churned and came back is already on the map.
- **Non-blocking.** A cycle issues its updates and returns without waiting for the map to render. Blocking on idle stalls the loop whenever idle is delayed (continuous zoom/pan never idles), which used to freeze playback colors until the user stopped. The loading indicator and playback timing resolve out of band instead (see Settling).
- **Transactional.** The updater records what the map reflects only after an apply fully succeeds. If one throws partway, that record stays at the last good state, so the next run re-derives the same diff and finishes the unfinished work rather than treating a half-applied state as done. This works because every map call sets a value to its target rather than incrementing, so re-applying converges. A deterministic failure retries once, then waits for the next state change — it never spins.
- **Time-sliced build.** Building the consolidated snapshot walks every asset and dominates a rebuild, and it runs every playback timestep, so it yields periodically to let the browser paint and take input mid-build; uncontended it runs at full speed.

## An update cycle, in order

One apply runs these steps in sequence and then commits:

1. Diff the new state against the last applied one to get the change flags; if nothing changed, stop.
2. If the change is heavy, show the loading indicator.
3. Rebuild the style if it changed — the one asynchronous, multi-step step.
4. Update the consolidated snapshot: a full rebuild at a sync point, or a prop reflect for symbology, results, or a large selection.
5. Update editions: rebuild the edited-and-selected live-set, and hide the edited assets in the consolidated snapshot so they render only from editions.
6. Update the ephemeral state, customer-point overlays, highlights, zones, and map overlay as their flags require.
7. Commit the applied state on the last line — the transactional point, and the baseline the next cycle diffs against.

Settling then happens out of band, when the map next goes idle.

## Settling: loading indicator and playback timing

"Tell the user the map is catching up" and "measure how long a heavy rebuild took, to pace playback" are one question — has the map caught up with the last heavy update? — answered when the map next goes idle. A single predicate defines a heavy update (sync point, import, edits, style, symbology, results, or a large selection). Keeping them one mechanism on one idle signal stops two definitions of "caught up" from drifting apart.

- The indicator always has a path to turn off, including when an apply throws — otherwise a failed heavy apply would leave it stuck on.
- Whether heavy work is still outstanding is derived at settle time by comparing the newest requested state against what the map reflects, covering both queued and in-flight work. If so, the indicator stays up and the timing sample is discarded, since it would span unshown work.
- None of it blocks. Awaiting a settle to measure was the original cause of the playback and zoom stalls; measuring out of band gives the same number without the stall.
- A duration measured while the tab was hidden is discarded.

## The rendering backend is swappable

The updater computes *what* the consolidated and editions states should contain but delegates *how* they reach the map to a backend behind a small interface. The default backend renders them as GeoJSON sources and layers in Mapbox GL. Rationale: separating update logic from rendering lets the rendering strategy change without touching any state, selection, or scheduling logic above; the updater stays agnostic to which backend is active.

### When a backend can't run: environment gate + runtime fallback

An alternative backend may be unavailable in a given browser — it can depend on a browser capability the environment doesn't provide (some in-app WebViews lack it). Two guards keep that from showing a blank map, and — because forcing the failure is awkward — **neither has automated coverage**; exercise them by hand when changing this path.

- **Environment gate, before selection.** Backend selection is gated on a support check as well as its flag, so an unsupported browser never selects the alternative backend and renders through geojson from the first frame.
- **Runtime fallback, after selection.** A backend can still fail to initialize *after* it was chosen. On an unrecoverable failure its `applyStyle` throws `MapBackendUnavailableError` (from `@epanet-js/map`) *before* it touches the map style, so no half-applied style is left behind. The updater catches it by name, reports it **once as a warning** (it's handled, not an error), latches `mapBackendFallbackAtom`, and marks the cycle for re-apply. The latch makes `useMapOperations` return the geojson backend, and because the transactional commit never ran on the throw, the re-apply re-derives the same diff and renders the whole map through geojson for the rest of the session. A reload re-attempts the preferred backend.

This leans on two existing invariants — the transactional commit (a throw leaves last-applied untouched, so the retry re-does the work) and the backend seam (swapping `useMapOperations`' return is enough to change *how* state reaches the map). Don't break either without revisiting this fallback.

## Change detection

Each cycle diffs the new state against the last-applied state and produces one flag per independently-updatable concern (edits, selection, symbology, results, style, zoom, and so on); only the work whose flag fired runs. Every flag is an identity check — which is what makes coalescing correct, since diffing newest against last-applied equals the sum of skipped diffs only if each flag is an equality check. A flag needing deep comparison would break that.

## Rules

- Never mutate the map outside the updater; go through its change detection and scheduler so ordering and serialization hold.
- Inside a cycle's apply, never add an early return after the change diff: it skips the end-of-apply commit and would re-apply that state forever. The apply must run straight through to the commit.
- Never block a cycle on the map finishing rendering (`idle`, `sourcedata`, per-source load state); it stalls the loop during continuous zoom or pan. The loading indicator and playback timing resolve out of band instead.
- Reach the consolidated and editions states through the backend interface, not by touching Mapbox sources directly — that keeps the backend swappable.
- Use Mapbox feature state only for small, bounded sets (e.g. hiding the few assets being edited), never for anything that scales with selection or network size.
- Keep the two-state split intact for every data category (features, icons, selection); don't reintroduce a whole-model representation.
- Bake per-feature styling (color, label) into the source at build time; don't push it into live per-frame expressions. Default colors and selection are the intended exceptions, carried as layer paint expressions.
- Keep change-detection flags identity-based, and keep the heavy-update predicate in step with what actually triggers a full rebuild.
- When a rendering backend can't run in the current browser, fall back to geojson rather than showing a blank map: gate selection on an environment check, and on a terminal runtime failure throw `MapBackendUnavailableError` so the updater reports once (as a warning) and re-applies through geojson. This path has no test coverage — verify by forcing the failure.

## Testing

Integration tests in `src/map/test/` drive a simulated map engine through real user interactions and assert on the resulting state. Test whole workflows (interaction to resulting map state) rather than individual functions, and prefer the map test helpers over reaching into internals. Run with `pnpm test`.

## Where it lives

Grep the entry symbol to land in the right place:

- Updater and change detection — the `useMapStateUpdates` hook and `detectChanges`, in `state-updates.ts`.
- Backend interface — the `MapOperations` interface and its default GeoJSON implementation, in `map-operations.ts`.
- Backend availability + fallback — the support gate applied where an alternative backend is registered, and the `MapBackendUnavailableError` catch that latches `mapBackendFallbackAtom` in the faceted updater (`state-updates-faceted.ts`), which `useMapOperations` reads to return geojson.
- Style, sources, and layers — `build-style.ts`, `data-source/`, `layers/`.
- Symbology rules and how they resolve to per-feature values — `symbology/`.
- Interaction modes and handlers — `useModeHandlers` and the per-mode handler sets in `mode-handlers/`.
- Customer-point overlays — `buildCustomerPointsOverlay` in `overlays/`.
