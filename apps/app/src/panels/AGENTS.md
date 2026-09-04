# Layout Architecture & Panel System

> **North star — partially implemented.**
> This document describes the target architecture for the panel and layout system. Treat it as the authoritative direction for new work, but expect the code to be at an earlier stage.
>
> **Current state:** The bottom dock (`BottomDock`) is the only dock on this architecture. Panels are modelled as data in a single list (`panelsAtom` → `placedPanelsAtom`); there is no separate static definition list. Right, left, and center docks, drag-and-drop, persistence of panel layout state, and the full flexible layout system are future phases.
>
> When in doubt about what is live, check which dock components exist in `src/panels/` — that is the ground truth for what has been implemented (see [Which Phase Is Active?](#which-phase-is-active)).

---

## Vocabulary (use consistently across agents and code)

- **Panel** — one open thing in a dock. Represented by a `Panel`: an `id`, a `type`, its `dock`, whether it is `closable`, and whatever config that type needs. Being in `panelsAtom` _is_ being open.
- **Dock** — a named layout area: `"left"` | `"right"` | `"center"` | `"bottom"`. Not all docks exist in all layouts: horizontal has all four, while vertical has only the map and one dock (`VERTICAL_DOCK`). Three separate things decide where a panel sits, and only the last is exposed to consumers:

  - **`Panel.initialDock`** — where it *opens* in horizontal layout. A starting point, not a location.
  - **`Panel.availableInVerticalLayout`** — whether it exists at all in vertical layout. An availability question, not a placement one, because there is only one dock to go to.
  - **`PanelLayout.movedToDock`** — where the user moved it. Horizontal only; there is nowhere to move a panel in vertical layout, so a move can never leak into it.

  `currentDock(panel, movedToDock, layout)` resolves those into **`PlacedPanel.dock`**, which is `undefined` when the panel is not available in the current layout. Not all docks exist in all layouts — `"left"` and `"right"` only exist in `"horizontal"` layout; `"vertical"` layout has only `"center"` and `"bottom"`.
- **Dock component** — the UI that owns a dock and renders its active panel. One per dock (`BottomDock`). Reads `panelsIn(dock)` and `activePanelIn(dock)`, never the registry directly.
- **Panel type** — the code-owned kind of a panel (`"asset-table"`, `"customer-point-table"`, `"hgl-profile"`), and the discriminant of the `Panel` union. Its behaviour lives in a `PanelTemplate`: how to render it, how to label it, and what to do when it is deactivated or closed. Types are a closed union, not registrations.
- **Panel instance** — a specific open panel of some type. A panel the user can open many times gets an **opaque `nanoid` id** (`newPanelId()`), so ids carry no meaning and nothing may be derived from them. A **singleton** panel — one the app opens at most once, like HGL or a seeded data table — uses a fixed, well-known id instead, which is what lets a `show-*` command detect "already open" and what keeps its layout state addressable across reloads.
- **Panel layout** (`panelLayoutAtom`) — what the user has changed about a panel, keyed by panel id: `movedToDock` (for when drag-and-drop lands) and `renamedTo`.
- **Panel content state** (`panelContentStateAtom`) — what a panel's component needs to restore itself, e.g. a data table's sorting, column widths, cursor and scroll. A separate atom on purpose: `placedPanelsAtom` reads only the layout, so a scroll or sort can never invalidate the registry or re-render a dock. Neither atom is persisted yet; `atomWithStorage` is the intended end state.
- **Panel registry** (`placedPanelsAtom`) — a **derived read-only atom** pairing each panel with its resolved placement. Dock components read the narrowed `panelsIn(dock)` / `activePanelIn(dock)` rather than this directly.

---

## Key Files

| File                                     | Role                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/panels/panel-template.tsx`          | `PanelTemplate`, the type→template registry (`panelFor`), `PanelContent`, `panelLabel`, `PanelLayout`, content-state types + accessors |
| `src/panels/panel.ts`                    | `Panel` union — **pure data, no atoms, no components**                                                       |
| `src/panels/<panel>/grid-state.ts`       | A panel type's own `contentState` shape                                                                      |
| `src/panels/<panel>/create-panel.ts`     | Per-type instance factories (pure) — safe for `src/state` to import                                          |
| `src/panels/<panel>/panel.tsx`           | Per-type template: component, label, lifecycle hooks                                                          |
| `src/panels/default-panels.ts`           | Panels registered at app start-up                                                                            |
| `src/panels/docks.ts`                    | `Dock`, `ResolvedLayout`, `resolveLayout` — leaf module, keeps `src/state` → `src/panels` acyclic            |
| `src/state/panels.ts`                    | `panelsAtom`, `panelLayoutAtom`, `panelContentStateAtom`, `placedPanelsAtom`, `activePanelIn`, `panelsIn` — **knows nothing about panel types** |
| `src/panels/bottom-dock/bottom-dock.tsx` | Dock for bottom dock                                                                                         |
| `src/panels/right-dock/right-dock.tsx`   | Dock for right dock (Phase 2C+)                                                                              |
| `src/panels/left-dock/left-dock.tsx`     | Dock for left dock (Phase 2D+)                                                                               |
| `src/state/layout.ts`                    | `splitsAtom` — bottom open/maximized and outer dock dimensions                                               |
| `src/components/epanet-app.tsx`          | Root layout — wires dock components into dock shells                                                         |
| `src/panels/index.tsx`                   | Dock shell components (`BottomPanel`, `SidePanel`, `LeftSidePanel`)                                          |

---

## Registry Structure

Two levels: code-owned panel **types**, and runtime panel **instances** plus their layout state, merged into a derived atom.

`src/panels/panel.ts` — pure, no atoms, so it lives with the panels rather than in `src/state`:

```typescript
type Common = { id: string; closable?: boolean };

export type Panel =
  | (Common & { type: "asset-table"; assetType: AssetType })
  | (Common & { type: "customer-point-table" })
  | (Common & { type: "hgl-profile" });

export type PanelType = Panel["type"];

// What each type is, independent of any open instance.
// Behaviour lives on the template, keyed by type in `panel-template.tsx`.
export type PanelTemplate<T extends PanelType> = {
  component: ComponentType<{ panel: PanelOfType<T> }>;
  buildLabel: (panel: PanelOfType<T>, translate: TranslateFn) => string;
  onDeactivate?: (context: PanelLifecycleContext, panel: PanelOfType<T>) => void;
  onClose?: (context: PanelLifecycleContext, panel: PanelOfType<T>) => void;
};

export const newPanelId = () => nanoid();
export const defaultPanels = (): Panel[];
```

`src/state/panels.ts` — the atoms and the merge:

```typescript
export const panelsAtom = atom<Panel[]>(defaultPanels());
export const panelLayoutAtom = atom<Record<string, PanelLayout>>({});        // { movedToDock?, renamedTo? }
export const panelContentStateAtom = atom<Record<string, PanelContentState>>({});

export const placedPanelsAtom = atom<PlacedPanel[]>(/* panels + layout, dock resolved */);
export const panelsByDockAtom = atom<Record<Dock, PlacedPanel[]>>(/* grouped by current dock */);
export const activePanelsAtom = atom<Record<Dock, PlacedPanel | null>>(/* null only when empty */);

// Narrowed per dock, so one dock changing does not notify the others.
export const panelsIn = (dock: Dock) => /* Atom<PlacedPanel[]> */;
export const activePanelIn = (dock: Dock) => /* Atom<PlacedPanel | null> */;
```

`PlacedPanel` is `{ id, closable, panel, dock, label? }` — `dock` already resolved.

**Instances must stay serializable — no components, no closures.** React identifies a component by the identity of its type, so a `component: () => <AssetDataTable/>` stored on a panel would be a _new_ function every time the panel list or `placedPanelsAtom` is rebuilt — opening or closing a panel, a layout-state change, a resize. React would see a different component type and unmount/remount the whole grid. A dock instead renders a stable module-level component looked up by `panel.type` (`PanelContent`).

**Import direction is one-way: `src/state` → `src/panels`.** `Dock` and `ResolvedLayout` live in `src/panels/docks.ts` so that `panel.ts` never has to import back from `src/state/panels.ts`. When the two did import each other, `tsc` still passed but type-aware ESLint lost the types and reported `no-unsafe-call` on `defaultPanels()` — a warning that is easy to scroll past. Keep the direction one-way and that class of confusion cannot start.

---

## Labels

A panel's label is computed at render from its current state, never frozen at creation:

```typescript
const label =
  entry.label ?? panelFor(entry.panel).buildLabel(entry.panel, translate);
```

Any command that changes the instance re-labels the panel for free — no second piece of state to keep in sync, and nothing goes stale when the locale changes. `renamedTo` is only for explicit user renames.

---

## Dock Pattern

Each dock components follows this structure:

```tsx
// Filter from the derived atom — always current, no need to update manually
const panels = useAtomValue(panelsIn("bottom"));
const currentLayout = /* derive from splitsAtom.layout, mapped to "horizontal"|"vertical" */;
const visiblePanels = panels.filter(p =>
  entry.dock === "bottom"
);
```

JSX structure:

```
<div className="absolute inset-0 flex flex-col">
  <div role="tablist" className="h-8 border-b ...">  ← tab buttons
  <div className="flex-1 min-h-0 overflow-auto">      ← active panel, in DefaultErrorBoundary
```

The active panel per dock comes from `activePanelIn(dock)`. It falls back to the dock's first panel when the selection is stale, so it is null only when the dock is empty.

---

## File Structure

```
src/panels/
  panel.ts                       ← the Panel union (pure data)
  panel-template.tsx             ← everything a panel type provides + the registry
  docks.ts                       ← Dock / ResolvedLayout (leaf, no imports from src/state)
  panel-close-button.tsx
  dock-empty-state.tsx
  bottom-dock/
    bottom-dock.tsx         ← Dock for bottom
    <panel-name>/
      <panel-name>-panel.tsx     ← the panel component
  right-dock/                    ← Phase 2C+
    right-dock.tsx
    <panel-name>/
  left-dock/                     ← Phase 2D+
    left-dock.tsx
  center/                        ← Phase 2E+
    layout-tree.ts               ← pure tree functions, no React
  resize-handle.tsx              ← Phase 3, ported from spike/ui-experiments/panels
```

---

## How to Add a New Panel

A panel type is a closed union member, so adding one touches four places — the compiler points at three of them.

1. **Create the component** at `src/panels/<dock>-dock/<panel-name>/<panel-name>-panel.tsx`.

   - Must use `className="h-full"` or `flex flex-col h-full` — its container is `flex-1 min-h-0`.
   - For an internal sidebar+detail split, use `VerticalResizer` from `src/dialogs/vertical-resizer.tsx` with local `useState`.
   - Compose from existing dialog internals (in `src/dialogs/<name>/`) — import inner components directly, not the modal wrapper.

2. **Add the type** to the `Panel` union in `src/panels/panel.ts`, carrying whatever config it needs. Add its content-state shape to `PanelContentStateByType` in `src/panels/panel-template.tsx` (`undefined` if it has none).

3. **Write its template** at `src/panels/<panel>/panel.tsx` — `component`, `buildLabel`, and any `onDeactivate` / `onClose` — and register it in `panelTemplates` in `src/panels/panel-template.tsx`. Add the label's translation key to the i18n files.

4. **Open it.** Add a `createXPanel()` factory at `src/panels/<panel>/create-panel.ts` — pure, so `src/state` can import it. For a panel that is always present, add it to `defaultPanels()`. For one the user opens on demand, write a `show-*` command that appends it to `panelsAtom` — `{ id: newPanelId(), type: ... }` for a panel that can be open many times, or a fixed id plus an "already present?" check for a singleton (see `useShowHglProfile`).

5. **Keep existing modal dialogs reachable** — the panel is additive until the flag is removed and confirmed.

6. **Write a test** that mounts the component standalone, without the full app context.

**Lifecycle.** Nothing panel-specific belongs in the dock components or in the commands. A panel type declares its own behaviour on its `PanelTemplate`:

- `onDeactivate` — the panel is losing focus (a tab switch, or the dock collapsing). It stays open, so discard only transient state, e.g. HGL leaves its map-picking mode but keeps the profile.
- `onClose` — the panel is going away. Discard its content and emit the close tracking event here.

Both receive `{ get, set, userTracking }` **and the instance**, so they can read and write app state without the command knowing anything about the type. `useClosePanel` calls `onDeactivate` before `onClose`, since closing implies leaving.

**Behaviour lives on the type; variation lives on the instance.** When two panels of the same type must behave differently, do _not_ put a function on the instance — put serializable config there and let the type's handler read it from the `instance` argument. `closable` already works this way (the seeded data tables set it `false`), and `assetTablePanel.onClose` reads `instance.assetType` for its tracking payload.

This keeps instances plain data, which is what lets them be persisted with the session, compared structurally, and rehydrated by type — a closure in `panelsAtom` would end all three, and could capture values that are stale by the time the panel closes.

---

## Visibility and Feature Flags

**A panel is visible because it is in `panelsAtom`.** There is no `shown` flag — "not open" is expressed by absence, so nothing can be registered-but-hidden and there is no second source of truth to keep in sync.

- **Build-time condition** (feature flag, permissions): don't seed the panel. Leave it out of `defaultPanels()` when the flag is off, or gate the `show-*` command that would create it.
- **Runtime user choice**: the user closes the panel, which removes the instance.

| What you're adding                | How to gate it                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| First real bottom panel content   | No gate — shown whenever `FLAG_BOTTOM_PANEL` (outer shell) is on                    |
| Experimental panel                | Seed it (or allow its `show-*` command) only when `isFeatureEnabled("FLAG_<NAME>")` |
| New dock components (right, left) | Gate at the dock components level — don't restructure docks without a flag          |
| Structural layout change          | `FLAG_FLEXIBLE_LAYOUT`                                                              |

Convention: `FLAG_SCREAMING_SNAKE_CASE`. Test via URL param `?FLAG_FOO=true`.

---

## State Management Rules

- **Ephemeral UI state** (selected row, collapsed section within a panel): `useState`. No Jotai atom.
- **A panel's label**: `panelLabel(panel, renamedTo, translate)` — `renamedTo` if the user set one, otherwise the template's `buildLabel`. Never store a rendered label, and never resolve it inline.
- **Which panel is active per dock**: `activePanelsAtom` in `src/state/panels.ts`, narrowed with `activePanelIn(dock)`. It resolves a stale selection to the dock's first panel, so it is null only when the dock is empty. Activate through `useActivatePanel`, which also deactivates the outgoing panel. Do not add per-panel open/closed atoms — a panel is open because it is in `panelsAtom`.
- **A panel's restorable UI state** (sorting, scroll, cursor, column widths): `panelContentStateAtom`, typed per panel type by `PanelContentStateByType` in `src/panels/panel-template.tsx`. **Not wired up yet** — nothing captures or restores it, so a data table still loses its sorting and scroll on a tab switch. The intent is to capture on unmount and restore on mount, since only the active panel is mounted.
- **Always read and write content state through `contentStateFor` / `withContentState`.** `panelContentStateAtom` is keyed by panel id, and an id does not carry its panel's type, so the atom holds the union of every type's state and cannot police which state belongs to which panel — setting it directly will happily store a data table's grid state against the HGL panel. Both accessors take the panel, which recovers the correlation and turns a mismatch into a compile error.
- **Panel's current dock**: read `PlacedPanel.dock`, already resolved. `currentDock(panel, movedToDock, layout)` does the resolving in one place. Do not track dock assignment anywhere else, and never read `movedToDock` directly — it is meaningless outside horizontal layout.
- **Whether a panel is open**: its presence in `panelsAtom`. Do not add visibility flags or per-panel open/closed atoms.
- **Do not add new fields to `Splits`** for panel content. `Splits` owns outer dock dimensions only.

---

## Resize Rules

- **Bottom panel shell**: handled by `BottomResizer` (existing in `src/components/resizer.tsx`). New panels get this for free.
- **Internal panel split** (sidebar + detail): use `VerticalResizer` from `src/dialogs/vertical-resizer.tsx` with local `useState`.
- **New dock panels (Phase 3)**: use the ported `ResizeHandle` from `src/panels/resize-handle.tsx`.

---

## Which Phase Is Active?

Check which dock components exist:

- Only `BottomDock` → bottom only. New panels go to `bottom-dock/`.
- `RightDock` exists → right dock accepts new panels.
- `LeftDock` exists → left dock accepts new panels.
- `FLAG_FLEXIBLE_LAYOUT` in use → cross-dock drag-and-drop is live.

Do not introduce a new dock components until there is an actual panel that needs it. Do not introduce DnD or center split trees until a concrete feature requires it.

---

## Known Tech Debt

| Debt                                                                 | Resolves when                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `bottomSidebarOpenAtom` and `splits.bottomOpen` must be kept in sync | Phase 3: merge into one atom                                     |
| `tabAtom` and `TabOption` enum are redundant                         | Phase 2C: right dock migrates to registry                        |
| Nothing writes the `dock` override yet                               | Phase 3: drag-and-drop populates it                              |
| `panelLayoutAtom` is not persisted (`atomWithStorage` is the intent) | Whenever panel layout should survive a reload                    |
| A **label** change re-renders a whole dock, not just the renamed tab | Only if renames become common — extract a memo'd `PanelTab` then |
