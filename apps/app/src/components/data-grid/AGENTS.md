# Data-Grid Tables

A spreadsheet-like table on **TanStack Table v8**. Import everything from `src/components/data-grid`.

Reference implementations:

- `src/dialogs/patterns/pattern-table.tsx` and `src/dialogs/curves/curve-table.tsx` — small editable tables: row actions, read-only columns, validation warnings, auto-added rows.
- `src/panels/data-tables/asset-data-table.tsx` — large model-backed tables: sorting, pinned columns, sliced copy/paste with `maxClipboardRows`, `patchRow`, cell and gutter context actions, and grid state restored through `initialGridState`.

A `"spreadsheet"` grid needs a container with a bounded height (`h-full` inside a panel, or a fixed height). Without one it grows unboundedly and nothing errors.

---

## Large tables: lazy row model, performance & OOM

The grid runs on datasets of **~450K rows**. A naive TanStack table materializes one `Row` object per data row up front; at that scale it froze the UI for seconds and OOM'd the tab. The mechanisms below exist to prevent that. **Any new feature that touches row data must respect them — otherwise it silently reintroduces the freeze/OOM at scale.** When adding a feature, ask: "what does this do at 450K rows?"

### The lazy row model

- The lazy row model is the **only** row model — every `<DataGrid>` uses it, at any size. `Row` objects are created **on access** and LRU-capped at `LAZY_ROW_MODEL_THRESHOLD` (1000), not built for the whole dataset. So `table.getRowModel().rows.length` is the full count, but **indexing `rows[i]` materializes that row**.
- `LAZY_ROW_MODEL_THRESHOLD` is purely the LRU cap (not a switch): below it nothing is evicted, above it the least-recently-used rows are dropped.
- See `models/lazy-core-row-model.ts` (core model) and `models/lazy-sticky-sorted-row-model.ts` (sorted order without Rows).

### Cardinal rule — never materialize the whole dataset

Any path that can span the full selection/dataset (copy, paste, sort, bulk edit, export) must **not** loop over `table.getRowModel().rows[i]` across all rows — each index materializes a `Row`, exactly what the lazy model avoids. Instead:

- **Read cell values off the model objects** via the column accessor: `column.accessorFn(original, dataIndex)` (canonical helper: `getSortValue` in `lazy-sticky-sorted-row-model.ts`). This resolves computed/`accessorFn` columns without a `Row`. Copy and sort both do this; do **not** reach for `row.getValue()` / `row.original` in a full-dataset loop.
- **Map a visual row position → data index without a `Row`**: read the precomputed order (`table.getLazyRowOrder().orderByDataIndex`); unsorted is identity. `clipboard-feature`'s `createDataIndexResolver` is the reference.
- Need only a count? `table.getRowModel().rows.length` is cheap (`length` doesn't materialize). Never `.rows.map(...)` / `.rows.filter(...)` over the full model.

Materialization is only acceptable bounded to the working set (viewport + overscan + a small selection) — virtualization only ever asks for visible indices.

The selection is stored as **visual** positions. Anything that reports it outside the grid must translate through the row order, as `onSelectionChange` does — passing positions out works until the table is sorted, then points at the wrong rows.

### Keep long synchronous work off the main thread

A loop over the whole dataset (building a paste, building edit moments, serializing a copy) blocks the main thread for its full run. Slice it:

- Wrap the loop with `createTimeSlicer()` from `src/infra/yield-to-main.ts` and `await` the returned guard once per iteration — it yields roughly every frame (50ms budget) so the tab stays responsive and overlays keep painting. The paste/copy loops and both data-table panels' `onChange` use this.
- Make the operation `async` and show the busy overlay through it: `useGridBusyState()` exposes `runBusyAsync` (paint busy → run blocking/async work → clear) for handler-heavy ops (copy/paste), and `runBusy` (a React transition) for render-heavy ops (sort). Route all copy/paste entry points through it for a consistent indicator. `onDataChange` may return a `Promise` so the grid awaits a sliced commit.

### Avoid accidental O(n²) and per-element re-work

- **Don't accumulate with spread in a loop** (`acc = [...acc, ...next]`) — that's O(n²); push element-wise. (Real bug: many single-row paste moments turned `mergeMoments` into O(n²).)
- **Don't re-normalize inside a comparator** — a sort calls it n·log(n) times. Precompute a sort key once per row and compare keys (see the `alphanumeric`/`text` precompute in `lazy-sticky-sorted-row-model.ts`); table-core's built-ins re-split / re-`toLowerCase` both operands on *every* comparison, which dominated a 450K sort.

### Memory / OOM

- **Don't retain large derived payloads.** Holding a multi-MB string/array in a closure or module var keeps it alive (defeats GC). The "add headers to last copy" path deliberately does **not** cache the copied body — it reads it back from the clipboard and prepends, caching only small fingerprints (selection, header row, body length) to detect change.
- **Bulk edits/pastes build an undo change set retained in history**, so one huge operation can OOM via the session history. `maxClipboardRows` (unset = no cap) bounds a single copy/paste; callers get `rows`/`requestedRows` on the copy/paste info to notify on truncation.
- **The model commit is an O(n) floor you can't chunk.** A bulk `onChange` should build **one** merged moment and `transact` once (never one transaction per row). The transaction clones model state immutably — proportional to the model and unavoidable — so keep the *moment-building* loop sliced, then commit once.

### One model: lazy-only

There is a **single** row model — the lazy one — for every table at every size. Keep it that way:

- **Don't reintroduce a size branch.** Write the Row-free patterns (read via `accessorFn`, map via the lazy order) — see the Cardinal rule above — never a `data.length`-gated standard path.
- The lazy model is a **fork of table-core** (8.17.3) and is load-bearing for *all* tables with no unforked fallback — the lazy-model tests are the safety net, keep them strong.
- Column auto-sizing measures **materialized (visible) rows only** for every table (`rowsToMeasure` in `column-sizing-feature.ts`) — there is no "measure all rows" path.

---

## Features

Cross-cutting grid behaviour belongs in a TanStack `TableFeature` (see `features/`), not in a hook inside `DataGrid`.

- **Cross-feature calls** go through the `table` instance with optional chaining (`table.getSelection?.()`) — the called feature may not be registered in every context (e.g. unit tests).
- **Options that change on every render** (callbacks) must be read as `table.options.onX` inside method bodies, not captured at `createTable` time — a captured callback goes stale silently.
- **Never import React** inside a feature file — features are pure table logic.

---

## Internal architecture (editing the grid itself)

### `table` is the single source of truth

Anything backed by a feature method is **read from `table`** at the consumer (`table.getActiveCell()`, `table.getSelection()`, `table.getEditMode()`, `table.getRowModel().rows.length`), not threaded through props or component state. The `useReactTable` instance is stable, so fresh reads at the top of a component pick up new values. Hooks in `hooks/` take `table` and derive what they need; the one exception is `useRowsNavigation`, which stays pure because it has its own unit tests.

### Don't wrap stable `table` methods just to forward them

Feature methods (`table.startEditing`, `table.clearSelection`, …) are stable references — pass them directly, including in `useImperativeHandle` and context-menu actions. Wrap only to add behaviour: copy/paste are wrapped on purpose so they run through `runBusyAsync`.

### Context-menu actions config

`cellContextActions` / `gutterContextActions` flow through the grids as plain action arrays plus `table`; the menu components read selection and sorted rows from `table`. Don't reintroduce a wrapper object that pre-bundles `getSelection` / `getSortedRows` callbacks.
