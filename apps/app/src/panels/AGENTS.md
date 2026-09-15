# Panels & Docks

## Vocabulary (use consistently across agents and code)

- **Panel** — one open thing in a dock. Represented by a `Panel` in `panel.ts`: an `id`, a `type`, whether it is `closable`, and whatever config that type needs. Being in `panelsAtom` _is_ being open.
- **Dock** — a named layout area. Not all docks exist in all layouts: vertical layout has only the map and `VERTICAL_DOCK`. Three separate things decide where a panel sits, and only the last is exposed to consumers:

  - **`Panel.initialDock`** — where it _opens_ in horizontal layout. A starting point, not a location.
  - **`Panel.availableInVerticalLayout`** — whether it exists at all in vertical layout. An availability question, not a placement one, because there is only one dock to go to.
  - **`PanelLayout.movedToDock`** — where the user moved it. Horizontal only; there is nowhere to move a panel in vertical layout, so a move can never leak into it.

  `currentDock` resolves those into **`PlacedPanel.dock`**, which is `undefined` when the panel is not available in the current layout.

- **Dock component** — the UI that owns a dock and renders its active panel. Reads `panelsIn(dock)` and `activePanelIn(dock)`, never the registry directly.
- **Panel type** — the code-owned kind of a panel, and the discriminant of the `Panel` union. Its behaviour lives in a `PanelTemplate`. Types are a closed union, not registrations.
- **Panel instance** — a specific open panel of some type. A panel the user can open many times gets an **opaque `nanoid` id** (`newPanelId()`), so ids carry no meaning and nothing may be derived from them. A **singleton** panel — one the app opens at most once — uses a fixed, well-known id instead, which is what lets a `show-*` command detect "already open" and what keeps its layout state addressable.
- **Panel layout** (`panelLayoutAtom`) — what the user has changed about a panel, keyed by panel id.
- **Panel registry** (`placedPanelsAtom`) — a derived read-only atom pairing each panel with its resolved placement.

## Instances are plain data

**No components or closures on an instance.** React identifies a component by the identity of its type, so a component stored on a panel would be a _new_ function every time the panel list or `placedPanelsAtom` is rebuilt — opening or closing a panel, a layout change, a resize — and React would unmount and remount the whole panel. A dock instead renders a stable module-level component looked up by `panel.type` (`PanelContent`).

**Behaviour lives on the type; variation lives on the instance.** When two panels of the same type must behave differently, put serializable config on the instance and let the template read it from the `panel` argument — `closable` works this way. A closure in `panelsAtom` would stop instances being persisted, compared structurally and rehydrated by type, and could capture values that are stale by the time the panel closes.

**Import direction is one-way: `src/state` → `src/panels`.** `Dock` and `ResolvedLayout` live in `docks.ts` so that `panel.ts` never imports back from `src/state/panels.ts`. When the two imported each other, `tsc` still passed but type-aware ESLint lost the types and reported `no-unsafe-call` — a warning that is easy to scroll past.

## Labels

A panel's label is computed at render through `panelLabel`, never stored. Any command that changes the instance re-labels the panel for free, and nothing goes stale when the locale changes. `renamedTo` is only for explicit user renames.

What the panel currently holds — a scoped table's row count — goes in the template's optional `buildDescription`, not appended to the label. The label says what the panel is and stays put. The tab renders the description in `text-subtle`, so it keeps that colour while the label follows the tab between base and accent. A rename replaces the label and leaves the description alone.

## Adding a panel type

Add the type to the `Panel` union, its entry to `PanelContentStateByType` and `panelTemplates`, a template, and a pure `create-panel.ts` factory — the compiler points at what is missing. Then open it: seed it from `useDefaultPanels` if it is always present, or write a `show-*` command that appends it to `panelsAtom`.

The panel component must fill its container with `h-full` (or `flex flex-col h-full`): the dock gives it a `flex-1 min-h-0` box, and without it the content collapses or overflows with no error.

**Lifecycle.** Nothing panel-specific belongs in the dock components or in the commands. A panel type declares it on its template:

- `onDeactivate` — the panel is losing focus (a tab switch, or the dock collapsing). It stays open, so discard only transient state, e.g. HGL leaves its map-picking mode but keeps the profile.
- `onClose` — the panel is going away. Discard its content and emit the close tracking event here.

Both receive `{ get, set, userTracking }` and the instance. `useActivatePanel` deactivates the outgoing panel, and `useClosePanel` deactivates before it closes.

## State

- **Whether a panel is open**: its presence in `panelsAtom`. There is no `shown` flag and no per-panel open/closed atom — "not open" is absence, so nothing can be registered-but-hidden. Gate a panel behind a flag by not seeding it, or by gating the `show-*` command that creates it.
- **Which panel is active per dock**: `activePanelIn(dock)`. It resolves a stale selection to the dock's first panel, so it is null only when the dock is empty. Activate through `useActivatePanel`.
- **Panel's current dock**: read `PlacedPanel.dock`. Never read `movedToDock` directly — it is meaningless outside horizontal layout.
- **Tab order**: `panelOrderAtom`, applied in `panelsByDockAtom` and written through `useReorderPanel`. Kept out of `panelsAtom` on purpose: `panelsAtom` means "what is open, in the order it was opened" and spans every dock, so reordering by splicing it would need slot-preserving surgery to leave the other docks alone and would churn the open set for anything watching it. A reorder must not activate or deactivate anything; keeping the order outside `panelsAtom` is what makes that true by construction.
- **Restorable UI state** (sorting, scroll, cursor, column widths): `panelContentStateAtom`, a separate atom so that a scroll or sort can never invalidate the registry or re-render a dock. **Captured from the user action that hides the panel, never on unmount.** `onDeactivate` is a plain function over `Panel` data and cannot reach the mounted component, so the data tables bridge that with `tableHandlesAtom`, which the mounted table publishes to and `onDeactivate` reads. Every path that deactivates therefore captures for free.

  Capturing at unmount looks tempting and does not work: React detaches the DOM node before cleanups run, so `scrollTop` reads `0`, and a snapshot that lands after `resetPanelsAtom` or `forgetPanelAtom` resurrects the state they just cleared. **A new way to hide a panel must deactivate it.**

- **Always read and write content state through `contentStateFor` / `withContentState`.** The atom is keyed by panel id, and an id does not carry its panel's type, so the atom cannot police which state belongs to which panel. Both accessors take the id **and the type**, which is what makes storing a data table's grid state against the HGL panel a compile error. Passing only an id would let `T` widen to `PanelType` and silently allow it.
- **Do not add fields to `Splits`** for panel content. `Splits` owns outer dock dimensions only.

## Dragging tabs

`PanelTab` makes the whole tab the drag handle, which puts dnd-kit and Radix on the same element. Three things fall out of that, and each looks like a bug rather than a decision:

- **`PointerSensor` needs `activationConstraint: { distance: 4 }`.** The drag listeners sit on the `Tabs.Trigger` itself, so without a movement threshold they swallow the click and tabs stop switching. The click-to-activate tests in `bottom-dock.test.tsx` are the guard.
- **`useSortable`'s `attributes` are deliberately not spread.** They carry `role="button"` and their own `tabIndex`, which displace the tab role and Radix's roving focus, and they advertise a space-bar interaction that only exists with a `KeyboardSensor` — which we do not register, because Radix already binds the arrow keys to move focus between tabs. Only `listeners` go on the tab. This is also why tabs cannot yet be reordered from the keyboard.
- **Use `CSS.Translate.toString(transform)`, never `CSS.Transform.toString`.** dnd-kit scales the dragged element by `over.rect.width / activeNodeRect.width`, so a tab dragged across neighbours of different label widths visibly stretches and squashes. `Translate` drops the scale and keeps the movement.

`DndContext` lives inside `TabRoot` so Radix's tab context is unbroken, and wraps only the tab strip.
