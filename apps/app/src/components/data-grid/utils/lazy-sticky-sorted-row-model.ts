import {
  type Column,
  type RowData,
  type RowModel,
  type SortingFn,
  type SortingState,
  type Table,
  getMemoOptions,
  memo,
  sortingFns,
} from "@tanstack/react-table";
import {
  type LazyRowModel,
  createOrderedLazyRowModel,
  isLazyRowModel,
} from "./lazy-core-row-model";
import { getStickySortedRowModel } from "./get-sticky-sorted-row-model";

export type LazyRowOrder = {
  // Display position -> row id (stable across data-array rebuilds). `null` means
  // identity (no active sort). This is the canonical stored order.
  orderIds: string[] | null;
  // Display position -> data index, for the current data array. Lets the ordered
  // row model resolve a visible row via the core model's index access (cheap
  // `getRowAt`) instead of `rowsById` — which would build a full id→index map on
  // every new data generation (i.e. every edit while sorted). `null` = identity.
  orderByDataIndex: Int32Array | null;
  // Data index -> display position. A compact derived lookup for `getVisualIndex`
  // (rebuilt only when row indices shift). `null` means identity.
  visualByDataIndex: Int32Array | null;
};

const IDENTITY_ORDER: LazyRowOrder = {
  orderIds: null,
  orderByDataIndex: null,
  visualByDataIndex: null,
};

/**
 * Reads the value to sort a row by — straight off the model object via the
 * column's accessor (identical to `Row.getValue`, but without a `Row`). The
 * accessor returns the stored value, so sorting never runs display transforms
 * (e.g. unit conversion) and the full dataset sorts without materializing rows.
 */
export function getSortValue<TData extends RowData>(
  table: Table<TData>,
  columnId: string,
  original: TData,
  index: number,
): unknown {
  const column = table.getColumn(columnId);
  return column?.accessorFn ? column.accessorFn(original, index) : undefined;
}

// table-core's RE for "string contains a number" (alphanumeric auto-detection).
const RE_SPLIT_ALPHANUMERIC = /([0-9]+)/gm;

/**
 * Auto-detects a column's sorting fn from its precomputed values — a faithful
 * port of table-core's `getAutoSortingFn` (incl. its `slice(10)` quirk of
 * skipping the first 10 rows), but over the in-memory value array so it never
 * materializes `Row` objects. (Calling `column.getSortingFn()` would: table-core
 * detects over `getFilteredRowModel().flatRows`, which in lazy mode materializes
 * the whole dataset.)
 */
function autoSortingFn<TData extends RowData>(
  values: unknown[],
): SortingFn<TData> {
  let isString = false;
  for (let i = 10; i < values.length; i++) {
    const value = values[i];
    if (Object.prototype.toString.call(value) === "[object Date]") {
      return sortingFns.datetime as SortingFn<TData>;
    }
    if (typeof value === "string") {
      isString = true;
      if (value.split(RE_SPLIT_ALPHANUMERIC).length > 1) {
        return sortingFns.alphanumeric as SortingFn<TData>;
      }
    }
  }
  return (isString ? sortingFns.text : sortingFns.basic) as SortingFn<TData>;
}

/**
 * Resolves a column's sorting fn without touching the row model — mirrors
 * table-core's `getSortingFn` (function → as-is; named → options/built-in;
 * `auto`/unset → auto-detect), but the auto branch reads precomputed values.
 */
function resolveSortingFn<TData extends RowData>(
  table: Table<TData>,
  column: Column<TData, unknown>,
  values: unknown[],
): SortingFn<TData> {
  const def = column.columnDef.sortingFn;
  if (typeof def === "function") return def;
  if (def && def !== "auto") {
    return (table.options.sortingFns?.[def] ??
      sortingFns[def]) as SortingFn<TData>;
  }
  return autoSortingFn<TData>(values);
}

/**
 * Computes the sorted display order over data indices, using value extraction
 * (no `Row` objects). Custom column `sortingFn`s call `row.getValue`, so we feed
 * them two reusable getValue shims; values are cached per (index, column) so each
 * row's value is computed at most once per sort.
 *
 * Comparator ported from `get-sticky-sorted-row-model.ts` (table-core 8.17.3).
 */
export function computeLazyRowOrder<TData extends RowData>(
  table: Table<TData>,
  sorting: SortingState,
  data: TData[],
): LazyRowOrder {
  const availableSorting = sorting.filter((sort) =>
    table.getColumn(sort.id)?.getCanSort(),
  );
  if (!availableSorting.length || data.length === 0) return IDENTITY_ORDER;

  const columnInfoById: Record<
    string,
    {
      sortUndefined?: false | -1 | 1 | "first" | "last";
      invertSorting?: boolean;
      sortingFn: SortingFn<TData>;
    }
  > = {};

  // Precompute each sort column's value once per row into a flat array indexed
  // by data index. The comparator then reads `values[index]` (O(1) array access)
  // instead of Map lookups — at ~n·log(n) comparisons that map overhead was the
  // dominant sort cost at scale.
  const valuesByColumn: Record<string, unknown[]> = {};

  for (const sortEntry of availableSorting) {
    const column = table.getColumn(sortEntry.id);
    if (!column) continue;
    const values = new Array<unknown>(data.length);
    for (let i = 0; i < data.length; i++) {
      values[i] = getSortValue(table, sortEntry.id, data[i], i);
    }
    valuesByColumn[sortEntry.id] = values;
    columnInfoById[sortEntry.id] = {
      sortUndefined: column.columnDef.sortUndefined,
      invertSorting: column.columnDef.invertSorting,
      // Resolve from the precomputed values — never `column.getSortingFn()`,
      // whose auto-detection iterates (materializes) the lazy row model.
      sortingFn: resolveSortingFn(table, column, values),
    };
  }

  // Two reusable shims avoid per-comparison allocation across the whole sort.
  const shimA = {
    index: 0,
    getValue: (id: string) => valuesByColumn[id][shimA.index],
  };
  const shimB = {
    index: 0,
    getValue: (id: string) => valuesByColumn[id][shimB.index],
  };

  const order = Array.from({ length: data.length }, (_, i) => i);
  order.sort((a, b) => {
    shimA.index = a;
    shimB.index = b;
    for (let i = 0; i < availableSorting.length; i++) {
      const sortEntry = availableSorting[i];
      const columnInfo = columnInfoById[sortEntry.id];
      if (!columnInfo) continue;
      const sortUndefined = columnInfo.sortUndefined;
      const isDesc = sortEntry?.desc ?? false;

      let sortInt = 0;

      if (sortUndefined) {
        const aValue = shimA.getValue(sortEntry.id);
        const bValue = shimB.getValue(sortEntry.id);
        const aUndefined = aValue === undefined;
        const bUndefined = bValue === undefined;
        if (aUndefined || bUndefined) {
          if (sortUndefined === "first") return aUndefined ? -1 : 1;
          if (sortUndefined === "last") return aUndefined ? 1 : -1;
          sortInt =
            aUndefined && bUndefined
              ? 0
              : aUndefined
                ? sortUndefined
                : -sortUndefined;
        }
      }

      if (sortInt === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sortInt = columnInfo.sortingFn(
          shimA as any,
          shimB as any,
          sortEntry.id,
        );
      }

      if (sortInt !== 0) {
        if (isDesc) sortInt *= -1;
        if (columnInfo.invertSorting) sortInt *= -1;
        return sortInt;
      }
    }
    return a - b; // stable tie-break by data index
  });

  const orderIds = new Array<string>(order.length);
  const orderByDataIndex = Int32Array.from(order);
  const visualByDataIndex = new Int32Array(data.length);
  for (let pos = 0; pos < order.length; pos++) {
    const dataIndex = order[pos];
    orderIds[pos] = table._getRowId(data[dataIndex], dataIndex, undefined);
    visualByDataIndex[dataIndex] = pos;
  }
  return { orderIds, orderByDataIndex, visualByDataIndex };
}

/**
 * Sticky lazy order getter. Sorts (computing values for all rows) only when the
 * sort state changes; when data changes but the sort doesn't (e.g. a cell edit),
 * it reuses the cached order by id — an O(n) re-map, not a re-sort — so editing
 * while sorted stays cheap. New rows are appended in data order, removed rows
 * dropped, mirroring `getStickySortedRowModel`.
 */
export function createLazyRowOrderGetter<TData extends RowData>(
  table: Table<TData>,
): () => LazyRowOrder {
  let cachedSortRef: SortingState | null = null;
  let cachedDataRef: TData[] | null = null;
  let cachedResult: LazyRowOrder = IDENTITY_ORDER;

  return () => {
    const sorting = table.getState().sorting;
    const data = table.options.data;

    if (!sorting?.length || data.length === 0) {
      cachedSortRef = null;
      cachedDataRef = data;
      cachedResult = IDENTITY_ORDER;
      return cachedResult;
    }

    const sortChanged = cachedSortRef !== sorting;
    const cachedOrderIds = cachedResult.orderIds;

    // In-place cell edit fast path: a new data array with the same length whose
    // differing rows keep their id at the same index (only the object ref/value
    // changed). The cached order, data-index map and visual map all stay valid —
    // sticky, no re-sort, no re-map. We confirm via an O(n) ref scan plus an
    // id check only on the rows that actually changed (O(edited)). A changed id
    // at some index means a reorder/replace → fall through to reconcile.
    if (
      !sortChanged &&
      cachedOrderIds !== null &&
      cachedDataRef !== null &&
      data.length === cachedDataRef.length
    ) {
      let inPlace = true;
      if (data !== cachedDataRef) {
        for (let i = 0; i < data.length; i++) {
          if (data[i] === cachedDataRef[i]) continue;
          if (
            table._getRowId(data[i], i, undefined) !==
            table._getRowId(cachedDataRef[i], i, undefined)
          ) {
            inPlace = false;
            break;
          }
        }
      }
      if (inPlace) {
        cachedDataRef = data;
        return cachedResult;
      }
    }

    if (sortChanged || cachedOrderIds === null) {
      cachedSortRef = sorting;
      cachedDataRef = data;
      cachedResult = computeLazyRowOrder(table, sorting, data);
      return cachedResult;
    }

    // Sticky reconcile: rows added/removed/reordered, sort unchanged → keep the
    // cached id order (drop missing, append new in data order), no re-sort.
    const idIndex = new Map<string, number>();
    for (let i = 0; i < data.length; i++) {
      idIndex.set(table._getRowId(data[i], i, undefined), i);
    }
    const orderIds: string[] = [];
    const seen = new Set<string>();
    for (const id of cachedOrderIds) {
      if (idIndex.has(id)) {
        orderIds.push(id);
        seen.add(id);
      }
    }
    for (let i = 0; i < data.length; i++) {
      const id = table._getRowId(data[i], i, undefined);
      if (!seen.has(id)) orderIds.push(id);
    }
    const orderByDataIndex = new Int32Array(orderIds.length);
    const visualByDataIndex = new Int32Array(data.length);
    for (let pos = 0; pos < orderIds.length; pos++) {
      const dataIndex = idIndex.get(orderIds[pos]);
      if (dataIndex !== undefined) {
        orderByDataIndex[pos] = dataIndex;
        visualByDataIndex[dataIndex] = pos;
      }
    }
    cachedDataRef = data;
    cachedResult = { orderIds, orderByDataIndex, visualByDataIndex };
    return cachedResult;
  };
}

/**
 * Drop-in for `getStickySortedRowModel()` in lazy mode. No active sort → returns
 * the (lazy) core model unchanged. Active sort → reorders via `getLazyRowOrder`
 * and presents the rows in display order lazily (only visible rows materialize).
 */
export function getLazyStickySortedRowModel<TData extends RowData>(): (
  table: Table<TData>,
) => () => RowModel<TData> {
  return (table) =>
    memo(
      () => [table.getState().sorting, table.getPreSortedRowModel()],
      (sorting, preSorted) => {
        if (!preSorted.rows.length || !sorting?.length) return preSorted;
        const { orderByDataIndex } = table.getLazyRowOrder();
        if (!orderByDataIndex) return preSorted;
        // In lazy mode the pre-sorted model is the lazy core model.
        return createOrderedLazyRowModel(
          preSorted as LazyRowModel<TData>,
          orderByDataIndex,
        );
      },
      getMemoOptions(
        table.options,
        "debugTable",
        "getLazyStickySortedRowModel",
      ),
    );
}

/**
 * Sorted row model that adapts per render to data size: the existing sticky
 * sorted model for small tables, the lazy (value-extractor) sort once past the
 * threshold. Both are instantiated once; the wrapper picks which to evaluate.
 */
export function getAdaptiveStickySortedRowModel<TData extends RowData>(): (
  table: Table<TData>,
) => () => RowModel<TData> {
  return (table) => {
    const standard = getStickySortedRowModel<TData>()(table);
    const lazy = getLazyStickySortedRowModel<TData>()(table);
    return () => (isLazyRowModel(table) ? lazy() : standard());
  };
}
