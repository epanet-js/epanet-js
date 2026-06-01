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
| `src/components/data-grid/features/clipboard-feature.ts` | Copy/paste (TSV) |
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
    floatColumn("x", { header: xHeader, size: 82, deleteValue: 0, nullValue: 0 }),
    floatColumn("y", { header: yHeader, size: 82, deleteValue: 0, nullValue: 0 }),
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
  deleteValue: 1.0,   // value set when user presses Delete/Backspace
  nullValue: 0,       // value when input is cleared to empty
})
```

- `deleteValue` — what Delete/Backspace writes into the cell (omit to write `null`)
- `nullValue` — what an empty string parses to (omit to store `null`)
- Copy/paste automatically converts to/from string

### `textColumn(accessorKey, options)`

Text input, optionally read-only.

```ts
// Editable
textColumn("label", { header: translate("label"), size: 120 })

// Read-only (computed/derived — user should never edit)
textColumn("timestep", { header: translate("timestep"), size: 82, isReadOnly: true })
```

Pass `isReadOnly: true` for computed or derived columns. You can also pass a function `isReadOnly: (rowIndex) => boolean` for per-row control.

### `booleanColumn(accessorKey, options)`

Checkbox renderer.

```ts
booleanColumn("active", { header: translate("active"), size: 60 })
```

### `filterableSelectColumn(accessorKey, options)`

Dropdown with search, keyboard navigation, and `"quick"` edit mode.

```ts
filterableSelectColumn("category", {
  header: translate("category"),
  options: categoryOptions,   // FilterableSelectOption<T>[]
  placeholder: translate("selectCategory"),
  size: 120,
})
```

`FilterableSelectOption<T>` is `{ value: T; label: string }`.

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
  pasteValue: (v) => v,
  deleteValue: "",
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

### Don't wrap stable `table` methods in `useCallback`

Methods attached by features (`table.startEditing`, `table.copySelection`, `table.handleCopyEvent`, etc.) are stable function references on a stable object. Pass them directly:

```tsx
// Wrong
const handleCopy = useCallback((e) => table.handleCopyEvent(e), [table]);
<div onCopy={handleCopy} />

// Right
<div onCopy={table.handleCopyEvent} />
```

Same applies to `useImperativeHandle` payloads and context-menu actions — assign `table.copySelection` directly.

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
