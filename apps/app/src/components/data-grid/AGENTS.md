# Data-Grid Tables

Our data-grid is a custom spreadsheet-like table built on top of **TanStack Table v8** (`@tanstack/react-table`). It provides inline editing, multi-cell selection, keyboard navigation, clipboard support, and row actions.

**Entry point**: `src/components/data-grid/` — import everything from `src/components/data-grid` (the `index.ts` barrel).

---

## Vocabulary

- **Row type** — a plain `Record<string, unknown>` that represents one row of data. Define a local type per table (e.g. `PatternRow`, `CurveRow`).
- **Column helper** — a factory function (`floatColumn`, `textColumn`, `booleanColumn`, `filterableSelectColumn`) that produces a `GridColumn`. Always prefer helpers over raw `GridColumn` literals.
- **`GridColumn`** — the column descriptor: `accessorKey`, `header`, optional `size`, `cellComponent`, `copyValue`, `pasteValue`, `deleteValue`, `disabled`, `disableKeys`.
- **`CellProps<TValue>`** — the props contract that every custom cell component must satisfy.
- **Edit mode** — `false` (not editing) | `"quick"` (arrow keys navigate, used for dropdowns) | `"full"` (input handles navigation, used for text/number).
- **`DataGridRef`** — imperative handle exposed via `forwardRef`: `selectCells`, `clearSelection`, `copySelection`, `selection`.
- **Variant** — `"spreadsheet"` (scrollable, height-constrained, borders) | `"inline"` (plain flex, no scrolling).
- **Feature** — a `TableFeature` object (TanStack extension point) that adds state, options, and methods to the table instance.

---

## Key Files

| File | Role |
|---|---|
| `src/components/data-grid/data-grid.tsx` | Main `DataGrid` component (thin host: wires the table, hooks, and chooses `VirtualGrid` vs `InlineGrid`) |
| `src/components/data-grid/types.ts` | `GridColumn`, `CellProps`, `DataGridRef`, `RowAction`, etc. |
| `src/components/data-grid/index.ts` | Public API — import from here |
| `src/components/data-grid/features/cell-editing-feature.ts` | Manages active cell and edit mode |
| `src/components/data-grid/features/cell-range-selection-feature.ts` | Multi-cell range selection |
| `src/components/data-grid/features/clipboard-feature.ts` | Copy/paste (TSV) — Row-free reads, sliced loops, `maxClipboardRows` cap |
| `src/components/data-grid/models/lazy-core-row-model.ts` | Lazy core row model + `isLazyRowModel`, `getAdaptiveCoreRowModel`, `LAZY_ROW_MODEL_THRESHOLD` |
| `src/components/data-grid/models/lazy-sticky-sorted-row-model.ts` | Sorted order over a lazy model without materializing rows; `getSortValue`, sort-key precompute |
| `src/components/data-grid/models/get-sticky-sorted-row-model.ts` | Standard (non-lazy) sticky sorted row model |
| `src/components/data-grid/hooks/use-grid-busy-state.ts` | Busy overlay state: `runBusy` (transition) / `runBusyAsync` (paint-then-run) |
| `src/infra/yield-to-main.ts` | `yieldToMain` / `createTimeSlicer` — slice long synchronous loops |
| `src/components/data-grid/shared/` | Internal sub-components: `VirtualGrid`, `InlineGrid`, `GridHeader`, `GridRow`, `VirtualRows`, `ScrollShadows`, `GridContextMenuWrapper`, etc. |
| `src/components/data-grid/hooks/` | Internal hooks: `useGridKeyboard`, `useScrollActiveCellIntoView`, `useContainerHeight`, `useScrollState`, `useHeaderScrollSync`, `useContextMenuTarget`, plus selection/clipboard/editing logic |
| `src/components/data-grid/cells/float-cell.tsx` | `floatColumn` helper + `FloatCell` |
| `src/components/data-grid/cells/text-cell.tsx` | `textColumn` helper + `TextCell` |
| `src/components/data-grid/cells/boolean-cell.tsx` | `booleanColumn` helper + `BooleanCell` |
| `src/components/data-grid/cells/filterable-select-cell.tsx` | `filterableSelectColumn` helper |
| `src/dialogs/patterns/pattern-table.tsx` | Reference implementation (row actions, readonly col, gutter) |
| `src/dialogs/curves/curve-table.tsx` | Reference implementation (validation warnings, auto-add rows) |

---

## Component API

```tsx
<DataGrid<TData>
  data={rowData}                   // TData[] — current rows
  columns={columns}                // GridColumn[]
  onChange={handleChange}          // (data: TData[]) => void
  createRow={createRow}            // () => TData — factory for new rows
  readOnly={false}                 // disables all editing
  variant="spreadsheet"            // "spreadsheet" | "inline"
  gutterColumn="selection"         // "hidden" | "selection" | "numbered"
  rowActions={rowActions}          // RowAction[] — appears in gutter context menu
  addRowLabel={translate("addPoint")}
  emptyState={<EmptyState />}      // shown when data.length === 0
  onSelectionChange={handler}      // (selection: GridSelection | null) => void
  cellHasWarning={cellHasWarning}  // (rowIndex, columnId) => boolean
  autoAddNewRows                   // create a new row when Tab-out of last row
  sortable                         // enable column sorting
  onColumnSort={handler}           // (columnId, direction) => void
  includeHeadersOnCopy             // prepend column headers on Ctrl+C
  onCopy={handler}                 // (info: ClipboardCopyInfo) => void
  onPaste={handler}                // (info: ClipboardPasteInfo) => void
  enableLazyRowModel               // opt into the lazy row model for large tables — see "Large tables" below
  maxClipboardRows={100000}        // optional cap on rows a single copy/paste handles (unset = no cap)
  ref={gridRef}                    // DataGridRef
/>
```

---

## Standard Table Pattern

Every table component follows this structure:

```tsx
// 1. Define the row type
type CurveRow = { x: number; y: number };

// 2. Convert domain model → rows (memoised)
const rowData = useMemo(() => toRows(points), [points]);

// 3. Define columns with helpers (memoised)
const columns = useMemo(
  () => [
    floatColumn("x", { header: xHeader, size: 82, emptyValue: 0 }),
    floatColumn("y", { header: yHeader, size: 82, emptyValue: 0 }),
  ],
  [xHeader, yHeader],
);

// 4. Define row actions (memoised)
const rowActions: RowAction[] = useMemo(
  () => [
    { label: translate("delete"), icon: <DeleteIcon size="sm" />, onSelect: handleDeleteRow },
    { label: translate("insertRowAbove"), icon: <AddIcon size="sm" />, onSelect: handleInsertRowAbove },
    { label: translate("insertRowBelow"), icon: <AddIcon size="sm" />, onSelect: handleInsertRowBelow },
  ],
  [translate, handleDeleteRow, handleInsertRowAbove, handleInsertRowBelow],
);

// 5. Provide a createRow factory
const createRow = useCallback((): CurveRow => ({ x: 0, y: 0 }), []);

// 6. Handle onChange — convert rows → domain model
const handleChange = useCallback((newRows: CurveRow[]) => {
  onChange(newRows.length === 0 ? [{ x: 0, y: 0 }] : newRows);
}, [onChange]);
```

Wrap the `<DataGrid>` in a `div` with `className="h-full"` when inside a panel so the spreadsheet fills its container.

---

## Column Helpers

### `floatColumn(accessorKey, options)`

Numeric input with locale formatting and parse validation.

```ts
floatColumn("multiplier", {
  header: translate("multiplier"),
  size: 82,
  emptyValue: 0,       // value committed when the cell is cleared (typed empty or Delete)
})
```

- `emptyValue` — value committed when input is cleared (typed empty or Delete). Match the model's type: use `null` for optional fields, a sensible default for required fields where "reset to default" is meaningful. **Omit entirely to forbid clearing** (typing empty is a no-op, Delete is a no-op) — use this for required fields that have no valid empty state.
- Copy/paste automatically converts to/from string

### `textColumn(accessorKey, options)`

Text input, optionally read-only.

```ts
// Editable, not clearable (required field — Delete is a no-op, paste of empty/invalid is skipped)
textColumn("label", { header: translate("label"), size: 120 })

// Editable, clearable to null (optional field)
textColumn("material", { header: translate("material"), size: 120, emptyValue: null })

// Read-only (computed/derived — user should never edit)
textColumn("timestep", { header: translate("timestep"), size: 82, isReadOnly: true })
```

- `emptyValue` — what to commit when input is cleared (typed empty, Delete, paste empty). Omit to forbid clearing. `meta.deleteValue` mirrors this.
- `isReadOnly` — `true` or `(rowIndex) => boolean` for per-row control.

### `booleanColumn(accessorKey, options)`

Checkbox renderer.

```ts
// Required boolean — Delete is a no-op
booleanColumn("active", { header: translate("active"), size: 60 })

// Nullable boolean — Delete writes null
booleanColumn("active", { header: translate("active"), size: 60, emptyValue: null })
```

### `filterableSelectColumn(accessorKey, options)`

Dropdown with search, keyboard navigation, and `"quick"` edit mode.

```ts
filterableSelectColumn("category", {
  header: translate("category"),
  options: categoryOptions,   // FilterableSelectOption<T>[]
  placeholder: translate("selectCategory"),
  size: 120,
  emptyValue: null,           // omit to forbid clearing
})
```

`FilterableSelectOption<T>` is `{ value: T; label: string }`. Paste skips the cell when the pasted text doesn't match any option's label or value.

---

## Row Actions

Row actions appear in the gutter's context menu. Enable them with `gutterColumn="selection"` + `rowActions`. Standard pattern for tabular data editors:

```ts
const rowActions: RowAction[] = useMemo(() => [
  {
    label: translate("delete"),
    icon: <DeleteIcon size="sm" />,
    onSelect: handleDeleteRow,
    disabled: () => rowData.length <= 1,  // prevent deleting the last row
  },
  {
    label: translate("insertRowAbove"),
    icon: <AddIcon size="sm" />,
    onSelect: handleInsertRowAbove,
  },
  {
    label: translate("insertRowBelow"),
    icon: <AddIcon size="sm" />,
    onSelect: handleInsertRowBelow,
  },
], [translate, handleDeleteRow, handleInsertRowAbove, handleInsertRowBelow, rowData.length]);
```

After mutating rows in an action handler, call `gridRef.current?.selectCells({ rowIndex })` to focus the right row.

---

## Validation Warnings

Use `cellHasWarning` to highlight cells with orange background. Compute the error set once, outside the callback:

```ts
const errorCells = useMemo(() => {
  const errors = validate(points);
  const set = new Set<string>();
  for (const e of errors) {
    set.add(`${e.index}:${e.columnId}`);
  }
  return set;
}, [points]);

const cellHasWarning = useCallback(
  (rowIndex: number, columnId: string) => errorCells.has(`${rowIndex}:${columnId}`),
  [errorCells],
);
```

`columnId` matches the `accessorKey` of the column.

---

## Imperative Handle (`DataGridRef`)

Use `forwardRef` + `useImperativeHandle` to expose the grid ref from a wrapper component:

```ts
export type PatternTableRef = DataGridRef;

export const PatternTable = forwardRef<DataGridRef, PatternTableProps>(
  function PatternTable(props, ref) {
    const gridRef = useRef<DataGridRef>(null);
    useImperativeHandle(ref, () => gridRef.current!, []);

    // ...

    return <DataGrid ref={gridRef} ... />;
  }
);
```

`DataGridRef` methods:
- `selectCells({ colIndex?, rowIndex?, extend? })` — move/extend selection programmatically
- `clearSelection()` — deselect everything (e.g. when clicking outside)
- `copySelection(options?)` — copy current selection to clipboard (`{ includeHeaders?: boolean }`)
- `selection` — current `GridSelection | null`

---

## Custom Cell Components

When no built-in helper fits, define a custom cell. The component must satisfy `CellProps<TValue>`:

```tsx
function MyCell({ value, editMode, onChange, stopEditing }: CellProps<string>) {
  // editMode: false | "quick" | "full"
  // Call onChange(newValue) to commit
  // Call stopEditing() to exit edit mode without committing
}

// Wire it into a GridColumn:
const column: GridColumn = {
  accessorKey: "myField",
  header: "My Field",
  cellComponent: MyCell,
  copyValue: (v) => String(v),
  pasteValue: (v) => v,    // return undefined to skip the cell (invalid input)
  deleteValue: "",         // omit to disable Delete (no-op)
};
```

- Use `"full"` edit mode for text/number inputs (the input handles arrow keys).
- Use `"quick"` edit mode for dropdowns (arrow keys navigate the list, not the grid).
- Always call `stopEditing()` on Escape; commit on Enter and blur.

---

## Developing New Features

New cross-cutting grid behaviours (undo/redo, row reordering, virtual scroll enhancements, etc.) belong as **TanStack `TableFeature` objects**, not as hooks inside `DataGrid`. This keeps the host component thin and each concern self-contained and testable.

### How features work

A feature is a plain object that implements TanStack's `TableFeature` interface. It can:

- Declare **initial state** by extending `TableState` via module augmentation and implementing `getInitialState`
- Declare **options** by extending `TableOptionsResolved` and implementing `getDefaultOptions`
- Attach **methods** to the `Table<TData>` instance inside `createTable`

Features communicate with each other by calling methods on the shared `table` instance (e.g. `ClipboardFeature` calls `table.getSelection()` from `CellRangeSelectionFeature`).

### Guidelines for feature authors

- Follow the [TanStack Table custom features guide](https://tanstack.com/table/latest/docs/guide/custom-features) for the `TableFeature` interface, module augmentation, and `createTable` patterns — the existing features (`CellEditingFeature`, `CellRangeSelectionFeature`, `ClipboardFeature`) are the best local reference.
- **Cross-feature calls** go through the `table` instance (e.g. `table.getSelection?.()`). Use optional chaining because the called feature may not be registered in every context (e.g. unit tests).
- **Options that change on every render** (callbacks) must be read as `table.options.onX` inside method bodies, not captured at `createTable` time — TanStack keeps `table.options` current.
- **Never import React** inside a feature file — features are pure table logic. Components that consume feature state live in `shared/` or cell files.
- Register new features in the `_features` array in `data-grid.tsx`. If the feature exposes props, add them to `DataGridProps` and thread through to `useReactTable`. If it exposes imperative methods, extend `DataGridRef` and forward them in `useImperativeHandle`.
- Re-export public types (`MyEventInfo`, etc.) from `features/index.ts` and `index.ts` so consumers can type their callbacks.

---

## Large tables: lazy row model, performance & OOM

The grid runs on datasets of **~450K rows**. A naive TanStack table materializes one `Row` object per data row up front; at that scale it froze the UI for seconds and OOM'd the tab. The mechanisms below exist to prevent that. **Any new feature that touches row data must respect them — otherwise it silently reintroduces the freeze/OOM at scale.** When adding a feature, ask: "what does this do at 450K rows?"

### The lazy row model

- Opt in with `enableLazyRowModel` on `<DataGrid>` (gated behind `FLAG_DATA_TABLES_PERFORMANCE` at the call site). It only *engages* once `data.length > LAZY_ROW_MODEL_THRESHOLD` (1000); below that it's the standard model. `isLazyRowModel(table)` reports the active state.
- When engaged, `Row` objects are created **on access** and LRU-capped (≈ the threshold), not built for the whole dataset. So `table.getRowModel().rows.length` is the full count, but **indexing `rows[i]` materializes that row**.
- See `models/lazy-core-row-model.ts` (core model) and `models/lazy-sticky-sorted-row-model.ts` (sorted order without Rows).

### Cardinal rule — never materialize the whole dataset

Any path that can span the full selection/dataset (copy, paste, sort, bulk edit, export) must **not** loop over `table.getRowModel().rows[i]` across all rows — each index materializes a `Row`, exactly what the lazy model avoids. Instead:

- **Read cell values off the model objects** via the column accessor: `column.accessorFn(original, dataIndex)` (canonical helper: `getSortValue` in `lazy-sticky-sorted-row-model.ts`). This resolves computed/`accessorFn` columns without a `Row`. Copy and sort both do this; do **not** reach for `row.getValue()` / `row.original` in a full-dataset loop.
- **Map a visual row position → data index without a `Row`**: in lazy mode read the precomputed order (`table.getLazyRowOrder().orderByDataIndex`); unsorted lazy is identity; standard tables use the (small) row model. `clipboard-feature`'s `createDataIndexResolver` is the reference.
- Need only a count? `table.getRowModel().rows.length` is cheap (`length` doesn't materialize). Never `.rows.map(...)` / `.rows.filter(...)` over the full model.

Materialization is only acceptable bounded to the working set (viewport + overscan + a small selection) — virtualization only ever asks for visible indices.

### Keep long synchronous work off the main thread

A loop over the whole dataset (building a paste, building edit moments, serializing a copy) blocks the main thread for its full run. Slice it:

- Wrap the loop with `createTimeSlicer()` from `src/infra/yield-to-main.ts` and `await` the returned guard once per iteration — it yields roughly every frame (50ms budget) so the tab stays responsive and overlays keep painting. The paste/copy loops and both data-table panels' `onChange` use this.
- Make the operation `async` and show the busy overlay through it: `useGridBusyState()` exposes `runBusyAsync` (paint busy → run blocking/async work → clear) for handler-heavy ops (copy/paste), and `runBusy` (a React transition) for render-heavy ops (sort). Route all copy/paste entry points through it for a consistent indicator. `onDataChange` may return a `Promise` so the grid awaits a sliced commit.

### Avoid accidental O(n²) and per-element re-work

- **Don't accumulate with spread in a loop** (`acc = [...acc, ...next]`) — that's O(n²); push element-wise. (Real bug: many single-row paste moments turned `mergeMoments` into O(n²).)
- **Don't re-normalize inside a comparator** — a sort calls it n·log(n) times. Precompute a sort key once per row and compare keys (see the `alphanumeric`/`text` precompute in `lazy-sticky-sorted-row-model.ts`); table-core's built-ins re-split / re-`toLowerCase` both operands on *every* comparison, which dominated a 450K sort.

### Memory / OOM

- **Don't retain large derived payloads.** Holding a multi-MB string/array in a closure or module var keeps it alive (defeats GC). The "add headers to last copy" path deliberately does **not** cache the copied body — it reads it back from the clipboard and prepends, caching only small fingerprints (selection, header row, body length) to detect change.
- **Bulk edits/pastes build an undo moment retained in history**, so one huge operation can OOM via the moment log. `maxClipboardRows` (unset = no cap) bounds a single copy/paste; callers get `rows`/`requestedRows` on the copy/paste info to notify on truncation.
- **The model commit is an O(n) floor you can't chunk.** A bulk `onChange` should build **one** merged moment and `transact` once (never one transaction per row). The transaction clones model state immutably — proportional to the model and unavoidable — so keep the *moment-building* loop sliced, then commit once.

### Roadmap: one model, not two (post-flag)

The dual model — standard below `LAZY_ROW_MODEL_THRESHOLD`, lazy above, chosen by `getAdaptiveCoreRowModel` / `getAdaptiveStickySortedRowModel` and gated by `FLAG_DATA_TABLES_PERFORMANCE` — is **temporary**. The agreed direction is: **once the flag is removed, go lazy-only** — delete the standard path (`getStickySortedRowModel`, the `getAdaptive*` wrappers) and every `isLazyRowModel(table)` branch, keeping the threshold solely as the LRU cap. Keeping both models is just transitional cost, not the target architecture.

While the flag still exists, write code that makes that collapse cheaper:

- **Don't add new `isLazyRowModel` branches** unless genuinely unavoidable. Write the lazy path (the future default) and let it run for both sizes; every new branch is one more thing to unwind later.
- **Prefer the Row-free patterns** (read via `accessorFn`, map via the lazy order) even where the standard model would let you cheat with `getRowModel().rows` — see the Cardinal rule above.
- Two things to settle at collapse time (flagged so they're not lost): (1) column auto-sizing measures **all** rows on the standard model vs **materialized only** on lazy (`rowsToMeasure` in `column-sizing-feature.ts`) — lazy-only makes "measure visible rows" the behaviour for every table; (2) the lazy model is a **fork of table-core** (8.17.3), so lazy-only makes that fork load-bearing for *all* tables with no unforked fallback — the lazy/standard parity tests are the safety net, keep them strong.

---

## Internal Architecture (for contributors editing the grid itself)

These conventions are not relevant to consumers of `<DataGrid>` — they apply when modifying anything under `src/components/data-grid/shared/` or `src/components/data-grid/hooks/`.

### `table` is the single source of truth

Anything backed by a feature method on `table` must be **read from `table`** at the consumer, not threaded through props or component state:

| Don't pass as a prop | Read from `table` |
|---|---|
| `activeCell` | `table.getActiveCell()` |
| `selection` | `table.getSelection()` |
| `editMode` | `table.getEditMode()` |
| `rowCount` (post-sort/filter) | `table.getRowModel().rows.length` |
| `colCount` (post-hide) | `table.getVisibleLeafColumns().length` |
| `startEditing` / `stopEditing` | `table.startEditing` / `table.stopEditing` |
| `copySelection` / `pasteSelection` | `table.copySelection` / `table.pasteSelection` |

The `useReactTable` instance is stable across renders, so the grid re-renders whenever feature state changes — fresh reads at the top of a component pick up the new value. **Don't** add a `selection` / `activeCell` / `editMode` prop to a new internal component; require `table` instead.

### Don't wrap stable `table` methods in `useCallback` just to forward them

Methods attached by features (`table.startEditing`, `table.stopEditing`, `table.copySelection`, etc.) are stable function references on a stable object. If you're only forwarding one, pass it directly:

```tsx
// Wrong — re-wrapping a stable method that you only forward
const handleClear = useCallback(() => table.clearSelection(), [table]);

// Right
onClick={table.clearSelection}
```

Same applies to `useImperativeHandle` payloads and context-menu actions — assign the method directly.

Wrapping **is** warranted when the handler adds behaviour rather than merely forwarding. Copy/paste are intentionally wrapped (`handleCopy` / `handlePaste`) so they can run through `runBusyAsync` and show the busy overlay (see "Large tables") — that's not gratuitous forwarding.

### When `activeCell`/`editMode` is needed in an effect dep array

A render-time local is the cleanest way to make a primitive value drive the effect *and* read it in the body without calling `table.getEditMode()` twice:

```tsx
const editMode = table.getEditMode();
useEffect(() => {
  if (wasEditing.current && !editMode) { /* ... */ }
  wasEditing.current = !!editMode;
}, [editMode]);
```

This is the only reason to keep a top-level alias.

### Custom hooks take `table`, not derived values

Hooks in `hooks/` that need feature state take `table: Table<TData>` and derive what they need internally — they do not accept `activeCell`, `editMode`, `rowCount`, or `colCount` as separate args. Two existing examples:

- `useGridKeyboard({ ref, table, selectCells, clearSelection, blurGrid, visibleRowCount })`
- `useScrollActiveCellIntoView({ scrollRef, table, gutterColumn, rowHeight })`

`useRowsNavigation` (the lower-level keyboard-navigation primitive used by `useGridKeyboard`) is the exception — it stays pure (no `table` dep) because it has its own unit tests.

### `VirtualGrid` vs `InlineGrid`

Both grids share the same prop surface (passed by `data-grid.tsx`) and the same shared sub-components (`GridHeader`, `GridRow`, `GridContextMenuWrapper`). `VirtualGrid` adds row virtualization (`@tanstack/react-virtual`), scroll-state tracking, scroll shadows, and header/body scroll sync. When adding behaviour that applies to both, prefer extracting a shared hook in `hooks/` or component in `shared/` over duplicating logic in each grid.

### Context-menu actions config

User-defined cell/gutter actions (`cellContextActions`, `gutterContextActions`) flow through the grids as plain action arrays plus `table` — there is no intermediate "config object". The menu components (`CellContextMenuContent`, `GutterContextMenuContent`) read selection and sorted rows from `table` directly. Don't reintroduce a wrapper object that pre-bundles `getSelection` / `getSortedRows` callbacks.

---

## Keyboard Shortcuts

| Key | Behaviour |
|---|---|
| Arrow keys | Navigate between cells |
| Enter | Enter edit mode / confirm and move down |
| Escape | Cancel edit / clear selection |
| Delete / Backspace | Clear cell to `deleteValue`, or delete row when gutter is selected |
| Tab / Shift-Tab | Move right/left between cells; Tab out of last cell exits grid |
| Character key | Open cell in `"quick"` edit mode |
| Ctrl/Cmd+C | Copy selected cells (tab-separated) |
| Ctrl/Cmd+V | Paste into selected cells |
| Click + Shift-click | Range selection |

---

## State Management Rules

- **Row data** — derive from the domain model with `useMemo`. Never store a copy in `useState`.
- **Columns** — define with `useMemo`. Dependencies: only translated headers or unit labels that change.
- **Row actions** — `useMemo`, with callbacks as dependencies.
- **Ephemeral UI state inside a cell** (edit buffer, error highlight) — `useState` inside the cell component only.
- **Column widths or other persisted user preferences** — `atomWithStorage` in `src/state/layout.ts`, following the `multiAssetPanelCollapseAtom` pattern. Do not add these to `DataGrid` itself.
- **Min-row invariant** — if deleting the last row would leave the table empty, replace it with a default row instead of allowing an empty `data` array (see `handleDeleteRow` in both reference files).

---

## Variants

| Variant | When to use |
|---|---|
| `"spreadsheet"` (default) | Data lives in a height-constrained container (panel, dialog). Adds `flex-1 min-h-0` and scroll. |
| `"inline"` | Table is part of a document-style layout where height is determined by content. No internal scroll. |

The container of a `"spreadsheet"` grid must have a bounded height — use `h-full` or a fixed height. Without it the grid grows unboundedly.
