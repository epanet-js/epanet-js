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
} from "./lazy-core-row-model";

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

// Resolves a column's sorting fn without materializing the row model
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

// Faithful port of table-core 8.17.3 `sortingFns.toString`: numbers stringify
// (NaN/±Infinity → ""), strings pass through, everything else → "".
function toSortString(value: unknown): string {
  if (typeof value === "number") {
    if (isNaN(value) || value === Infinity || value === -Infinity) return "";
    return String(value);
  }
  if (typeof value === "string") return value;
  return "";
}

// A precomputed alphanumeric sort key: avoids ~1M object allocations when keying a large column.
export type AlphanumericKey = (string | number)[];

export function buildAlphanumericKey(
  value: unknown,
  lower: boolean,
): AlphanumericKey {
  const str = lower ? toSortString(value).toLowerCase() : toSortString(value);
  const parts = str.split(RE_SPLIT_ALPHANUMERIC).filter(Boolean);
  const key: AlphanumericKey = new Array(parts.length);
  for (let i = 0; i < parts.length; i++) {
    const num = parseInt(parts[i], 10);
    key[i] = isNaN(num) ? parts[i] : num;
  }
  return key;
}

export function compareAlphanumericKeys(
  a: AlphanumericKey,
  b: AlphanumericKey,
): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const aChunk = a[i];
    const bChunk = b[i];
    if (typeof aChunk === "number") {
      if (typeof bChunk === "number") {
        if (aChunk > bChunk) return 1;
        if (bChunk > aChunk) return -1;
      } else {
        return 1; // a is a number, b a string → string sorts first
      }
    } else if (typeof bChunk === "number") {
      return -1; // a is a string, b a number → string sorts first
    } else {
      if (aChunk > bChunk) return 1;
      if (bChunk > aChunk) return -1;
    }
  }
  return a.length - b.length;
}

// table-core's `compareBasic` over precomputed text keys.
function compareTextKeys(a: string, b: string): number {
  return a === b ? 0 : a > b ? 1 : -1;
}

type SortStrategy =
  | { kind: "alphanumeric"; keys: AlphanumericKey[] }
  | { kind: "text"; keys: string[] }
  | { kind: "fn" };

type SortColumnInfo<TData extends RowData> = {
  sortUndefined?: false | -1 | 1 | "first" | "last";
  invertSorting?: boolean;
  sortingFn: SortingFn<TData>;
};

function buildSortStrategies<TData extends RowData>(
  availableSorting: SortingState,
  columnInfoById: Record<string, SortColumnInfo<TData>>,
  valuesByColumn: Record<string, unknown[]>,
): SortStrategy[] {
  return availableSorting.map((sortEntry) => {
    const fn = columnInfoById[sortEntry.id]?.sortingFn;
    const values = valuesByColumn[sortEntry.id];
    if (!fn || !values) return { kind: "fn" };
    if (
      fn === sortingFns.alphanumeric ||
      fn === sortingFns.alphanumericCaseSensitive
    ) {
      const lower = fn === sortingFns.alphanumeric;
      return {
        kind: "alphanumeric",
        keys: values.map((v) => buildAlphanumericKey(v, lower)),
      };
    }
    if (fn === sortingFns.text || fn === sortingFns.textCaseSensitive) {
      const lower = fn === sortingFns.text;
      return {
        kind: "text",
        keys: values.map((v) =>
          lower ? toSortString(v).toLowerCase() : toSortString(v),
        ),
      };
    }
    return { kind: "fn" };
  });
}

export function computeLazyRowOrder<TData extends RowData>(
  table: Table<TData>,
  sorting: SortingState,
  data: TData[],
): LazyRowOrder {
  const availableSorting = sorting.filter((sort) =>
    table.getColumn(sort.id)?.getCanSort(),
  );
  if (!availableSorting.length || data.length === 0) return IDENTITY_ORDER;

  const columnInfoById: Record<string, SortColumnInfo<TData>> = {};

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
      // Resolve from the precomputed values — never `column.getSortingFn()`
      sortingFn: resolveSortingFn(table, column, values),
    };
  }

  const strategies = buildSortStrategies(
    availableSorting,
    columnInfoById,
    valuesByColumn,
  );

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
        const strategy = strategies[i];
        if (strategy.kind === "alphanumeric") {
          sortInt = compareAlphanumericKeys(strategy.keys[a], strategy.keys[b]);
        } else if (strategy.kind === "text") {
          sortInt = compareTextKeys(strategy.keys[a], strategy.keys[b]);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sortInt = columnInfo.sortingFn(
            shimA as any,
            shimB as any,
            sortEntry.id,
          );
        }
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
 * dropped (sticky ordering).
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
