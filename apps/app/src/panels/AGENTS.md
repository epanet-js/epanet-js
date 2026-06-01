# Layout Architecture & Panel System

> **North star — not yet fully implemented.**
> This document describes the target architecture for the panel and layout system. It is the design we are building towards, not a description of the current codebase. Treat it as the authoritative direction for new work, but expect the code to be at an earlier stage.
>
> **Current state:** The bottom zone tab manager (`BottomZoneTabs`) is the first zone being migrated to this architecture. The panel registry (`src/panels/registry.ts`), the `PANEL_DEFINITIONS` structure, and `panelRegistryAtom` are being introduced as part of this work. Right, left, and center zones, drag-and-drop, and the full flexible layout system are future phases.
>
> When in doubt about what is live, check which zone tab managers exist in `src/panels/` — that is the ground truth for what has been implemented (see [Which Phase Is Active?](#which-phase-is-active)).

---

## Vocabulary (use consistently across agents and code)

- **Panel** — a content component (leaf). Has an `id`, a `labelKey`, an optional `icon`, a `component`, a `defaultZone`, and an optional `shown` flag. Registered once in the global registry. A panel registered in a zone does not necessarily show — `shown` (default `true`) controls visibility for both build-time conditions (feature flags, permissions) and runtime user choice.
- **Zone** — a named layout area: `"left"` | `"right"` | `"center"` | `"bottom"`. Not all zones exist in all layouts — `"left"` and `"right"` only exist in `"horizontal"` layout; `"vertical"` layout has only `"center"` and `"bottom"`.
- **Zone Tab Manager** — the UI component that owns a zone and renders the currently active panel within it. One per zone. Reads from the panel registry filtered by the zone that applies for the current layout.
- **Panel definition** — the static, code-owned part of a panel: `id`, `labelKey`, `icon`, `component` (React component type, not an instance), `defaultZone`. Never changes at runtime.
- **Panel layout state** — the runtime/user-owned part: `shown`, `zone` override. Lives in a persisted atom keyed by panel id, separate from the definitions so it can be saved with `atomWithStorage`.
- **Panel registry** (`panelRegistryAtom`) — a **derived read-only atom** that merges definitions with layout state. This is what zone tab managers read. Always up to date because it derives reactively from both sources.

---

## Key Files

| File | Role |
|---|---|
| `src/panels/registry.ts` | `PANEL_DEFINITIONS`, `panelLayoutStateAtom`, `panelRegistryAtom`, `effectiveZone` — **edit `PANEL_DEFINITIONS` to add or move any panel** |
| `src/panels/bottom-zone/bottom-zone-tabs.tsx` | Zone Tab Manager for bottom zone |
| `src/panels/right-zone/right-zone-tabs.tsx` | Zone Tab Manager for right zone (Phase 2C+) |
| `src/panels/left-zone/left-zone-tabs.tsx` | Zone Tab Manager for left zone (Phase 2D+) |
| `src/state/layout.ts` | Per-zone active tab atoms, bottom open/maximized |
| `src/components/epanet-app.tsx` | Root layout — wires zone tab managers into zone shells |
| `src/panels/index.tsx` | Zone shell components (`BottomPanel`, `SidePanel`, `LeftSidePanel`) |

---

## Registry Structure (`src/panels/registry.ts`)

Two-level structure: static definitions (code-owned) + persisted layout state (user-owned), merged into a derived atom.

```typescript
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type Zone = "left" | "right" | "center" | "bottom";
export type ResolvedLayout = "horizontal" | "vertical"; // maps to "HORIZONTAL"/"VERTICAL" in layout.ts

// Static definition — never changes at runtime. Component is a type reference, not an instance.
export interface PanelDefinition {
  id: string;
  labelKey: string;            // i18n key, resolved via useTranslate()
  icon?: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  defaultZone: Partial<Record<ResolvedLayout, Zone>>;
  // e.g. { horizontal: "right", vertical: "bottom" }
  // Omit a layout key to hide the panel in that layout (e.g. { horizontal: "left" } → not shown on vertical)
}

// Runtime/user-owned state — serializable, persisted across sessions.
export interface PanelState {
  shown?: boolean;  // visible when true (default: true). User or flag can set false to hide.
  zone?: Zone;      // current zone override (Phase 3 drag-and-drop). Unset = use defaultZone.
}

// Merged view — what zone tab managers read.
export type PanelEntry = PanelDefinition & PanelState;

// ── Static definitions ────────────────────────────────────────────
// To add a panel: add an entry here. This is the only place.
export const PANEL_DEFINITIONS: PanelDefinition[] = [
  { id: "assets", labelKey: "panels.assets.label", icon: TableIcon, component: AssetsTable, defaultZone: { horizontal: "bottom", vertical: "bottom" } },
  // { id: "patterns", ..., defaultZone: { horizontal: "bottom", vertical: "bottom" } },
  // { id: "feature-editor", ..., defaultZone: { horizontal: "right", vertical: "bottom" } },
  // { id: "network-review", ..., defaultZone: { horizontal: "left" } }, // not shown on vertical
];

// ── Runtime layout state ──────────────────────────────────────────
// Persisted: only serializable data (shown, zone). Component refs stay in PANEL_DEFINITIONS.
export const panelLayoutStateAtom = atomWithStorage<Record<string, PanelState>>(
  "panel-layout",
  {
    // "assets" has no entry → shown defaults to true
    // "patterns": { shown: isFeatureEnabled("FLAG_PATTERNS_PANEL") },
  }
);

// ── Derived registry ──────────────────────────────────────────────
// Read-only merged view. Always up to date. This is what zone tab managers consume.
export const panelRegistryAtom = atom<PanelEntry[]>((get) => {
  const state = get(panelLayoutStateAtom);
  return PANEL_DEFINITIONS.map(def => ({ ...def, ...state[def.id] }));
});

// Helper used by zone tab managers:
export function effectiveZone(entry: PanelEntry, layout: ResolvedLayout): Zone | undefined {
  return entry.zone ?? entry.defaultZone[layout];
}
```

---

## Zone Tab Manager Pattern

Each zone tab manager follows this structure:

```tsx
// Filter from the derived atom — always current, no need to update manually
const panels = useAtomValue(panelRegistryAtom);
const currentLayout = /* derive from splitsAtom.layout, mapped to "horizontal"|"vertical" */;
const visiblePanels = panels.filter(p =>
  effectiveZone(p, currentLayout) === "bottom" && p.shown !== false
);
```

JSX structure:
```
<div className="absolute inset-0 flex flex-col">
  <div role="tablist" className="h-8 border-b ...">  ← tab buttons
  <div className="flex-1 min-h-0 overflow-auto">      ← active panel, in DefaultErrorBoundary
```

Active tab state lives in the per-zone atom (e.g., `bottomActiveTabAtom`). Falls back to the first visible panel when null or when the current active panel is no longer visible.

---

## File Structure

```
src/panels/
  registry.ts                    ← PANEL_DEFINITIONS + panelLayoutStateAtom + panelRegistryAtom
  bottom-zone/
    bottom-zone-tabs.tsx         ← Zone Tab Manager for bottom
    <panel-name>/
      <panel-name>-panel.tsx     ← the panel component
  right-zone/                    ← Phase 2C+
    right-zone-tabs.tsx
    <panel-name>/
  left-zone/                     ← Phase 2D+
    left-zone-tabs.tsx
  center/                        ← Phase 2E+
    layout-tree.ts               ← pure tree functions, no React
  resize-handle.tsx              ← Phase 3, ported from spike/ui-experiments/panels
```

---

## How to Add a New Panel

1. **Create the component** at `src/panels/<zone>-zone/<panel-name>/<panel-name>-panel.tsx`.
   - Must use `className="h-full"` or `flex flex-col h-full` — its container is `flex-1 min-h-0`.
   - For an internal sidebar+detail split, use `VerticalResizer` from `src/dialogs/vertical-resizer.tsx` with local `useState` for width.
   - Compose from existing dialog internals (in `src/dialogs/<name>/`) — import inner components directly, not the modal wrapper.

2. **Register** by adding a `PanelDefinition` to `PANEL_DEFINITIONS` in `src/panels/registry.ts`:
   ```typescript
   {
     id: "your-panel",
     labelKey: "panels.yourPanel.label",
     icon: YourIcon, // optional
     component: YourPanelPanel,
     defaultZone: { horizontal: "bottom", vertical: "bottom" },
   },
   ```
   Add the translation key to the i18n files.

3. **Gate it** if experimental — add an initial entry to `panelLayoutStateAtom`'s default value:
   ```typescript
   "your-panel": { shown: isFeatureEnabled("FLAG_YOUR_PANEL") },
   ```

4. **Keep existing modal dialogs reachable** — the panel is additive until the flag is removed and confirmed.

5. **Write a test** that mounts the component standalone, without the full app context.

---

## Visibility and Feature Flags

`shown` in `PanelEntry` is the single mechanism for controlling whether a panel is visible. It defaults to `true` when omitted. It serves two purposes:

- **Build-time condition** (feature flag, permissions): set `shown: isFeatureEnabled("FLAG_<NAME>")` in `panelLayoutStateAtom`'s default — panel hidden when flag is off.
- **Runtime user choice** (user hides/shows panel): update `panelLayoutStateAtom` at runtime:
  ```typescript
  store.set(panelLayoutStateAtom, prev => ({ ...prev, "panel-id": { ...prev["panel-id"], shown: false } }));
  ```

| What you're adding | How to gate it |
|---|---|
| First real bottom panel content | No gate — shown whenever `FLAG_BOTTOM_PANEL` (outer shell) is on |
| Experimental bottom panel tab | `shown: isFeatureEnabled("FLAG_<NAME>")` in `panelLayoutStateAtom` default |
| New zone tab manager (right, left) | Gate at the zone tab manager level — don't restructure zones without a flag |
| Structural layout change | `FLAG_FLEXIBLE_LAYOUT` |

Convention: `FLAG_SCREAMING_SNAKE_CASE`. Test via URL param `?FLAG_FOO=true`.

---

## State Management Rules

- **Ephemeral UI state** (selected row, collapsed section within a panel): `useState`. No Jotai atom.
- **Which panel is active per zone**: use the per-zone active tab atom (e.g., `bottomActiveTabAtom` in `src/state/layout.ts`). Do not add per-panel open/closed atoms.
- **Persisted preferences** (column widths, section collapse across sessions): `atomWithStorage` in `src/state/layout.ts`, following the `multiAssetPanelCollapseAtom` pattern.
- **Panel's current zone assignment**: `effectiveZone(entry, layout)` — resolves `zone` override from `panelLayoutStateAtom` first, then `defaultZone[layout]` from `PANEL_DEFINITIONS`. Do not track zone assignment anywhere else.
- **Panel's shown/hidden state**: `panelLayoutStateAtom` in `src/panels/registry.ts`. Persisted via `atomWithStorage`. Do not add per-panel visibility atoms anywhere else.
- **Do not add new fields to `Splits`** for panel content. `Splits` owns outer zone dimensions only.

---

## Resize Rules

- **Bottom panel shell**: handled by `BottomResizer` (existing in `src/components/resizer.tsx`). New panels get this for free.
- **Internal panel split** (sidebar + detail): use `VerticalResizer` from `src/dialogs/vertical-resizer.tsx` with local `useState`.
- **New zone panels (Phase 3)**: use the ported `ResizeHandle` from `src/panels/resize-handle.tsx`.

---

## Which Phase Is Active?

Check which zone tab managers exist:

- Only `BottomZoneTabs` → bottom only. New panels go to `bottom-zone/`.
- `RightZoneTabs` exists → right zone accepts new panels.
- `LeftZoneTabs` exists → left zone accepts new panels.
- `FLAG_FLEXIBLE_LAYOUT` in use → cross-zone drag-and-drop is live.

Do not introduce a new zone tab manager until there is an actual panel that needs it. Do not introduce DnD or center split trees until a concrete feature requires it.

---

## Known Tech Debt

| Debt | Resolves when |
|---|---|
| `bottomSidebarOpenAtom` and `splits.bottomOpen` must be kept in sync | Phase 3: merge into one atom |
| `tabAtom` and `TabOption` enum are redundant | Phase 2C: right zone migrates to registry |
| `zone` override absent from `panelLayoutStateAtom` initial values | Phase 3: drag-and-drop populates it |
