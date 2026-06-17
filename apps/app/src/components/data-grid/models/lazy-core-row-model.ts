import {
  type Row,
  type RowData,
  type RowModel,
  type Table,
  createRow,
  getCoreRowModel,
  getMemoOptions,
  memo,
} from "@tanstack/react-table";

// Above this many rows the grid switches to the lazy row model: TanStack `Row`
// objects are materialized on access (not all up front), which keeps mount/edit
// CPU and heap bounded to the working set instead of the full row count.
// (Building one `Row` per data row is what froze the UI and OOM'd at ~450K.)
//
// Also used as the LRU cap: at most this many materialized rows are retained
// per data generation — far more than a viewport + overscan + any realistic
// selection, and re-accessing an evicted row just recreates it (cheap).
//
// Forked against @tanstack/table-core 8.17.3 — re-check `createRow` /
// `getCoreRowModel` on upgrade.
export const LAZY_ROW_MODEL_THRESHOLD = 1000;

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableOptionsResolved<TData extends RowData> {
    // Opt-in via `PerformantDataGrid` / `enableLazyRowModel`. The lazy row model
    // only engages when this is true AND the data is over threshold.
    lazyRowModel?: boolean;
  }
}

export type LazyRowModel<TData extends RowData> = RowModel<TData> & {
  getMaterializedRows: () => Row<TData>[];
};

/** Whether the grid should use the lazy row model for the current data size. */
export function isLazyRowModel<TData extends RowData>(
  table: Table<TData>,
): boolean {
  return (
    table.options.lazyRowModel === true &&
    table.options.data.length > LAZY_ROW_MODEL_THRESHOLD
  );
}

/**
 * Builds a lazy, array-like `rows` collection: `length` is the full data length,
 * but a `Row` is created (and LRU-cached) only when an index is actually read.
 * Returned as a `Proxy` so existing consumers keep using `rows[i]` / `rows.length`
 * unchanged. Full iteration (`map`/spread/`for..of`) still works but materializes
 * what it visits — hot paths that did that have been moved off the row model.
 */
function createLazyRows<TData extends RowData>(
  table: Table<TData>,
  data: TData[],
): {
  rows: Row<TData>[];
  getRowAt: (index: number) => Row<TData> | undefined;
  getCachedRows: () => Row<TData>[];
} {
  const length = data.length;
  const cache = new Map<number, Row<TData>>();

  const getRowAt = (index: number): Row<TData> | undefined => {
    if (index < 0 || index >= length) return undefined;
    const cached = cache.get(index);
    if (cached) {
      // Touch for LRU recency.
      cache.delete(index);
      cache.set(index, cached);
      return cached;
    }
    const original = data[index];
    const row = createRow(
      table,
      table._getRowId(original, index, undefined),
      original,
      index,
      0,
      undefined,
      undefined,
    );
    cache.set(index, row);
    if (cache.size > LAZY_ROW_MODEL_THRESHOLD) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return row;
  };

  const proxy = new Proxy([] as unknown as Row<TData>[], {
    get(_target, key) {
      if (key === "length") return length;
      if (key === Symbol.iterator) {
        return function* () {
          for (let i = 0; i < length; i++) yield getRowAt(i) as Row<TData>;
        };
      }
      if (typeof key === "string") {
        const index = Number(key);
        if (Number.isInteger(index)) return getRowAt(index);
      }
      return Reflect.get(_target, key) as unknown;
    },
    has(_target, key) {
      if (typeof key === "string") {
        const index = Number(key);
        if (Number.isInteger(index)) return index >= 0 && index < length;
      }
      return Reflect.has(_target, key);
    },
  });

  // The rows materialized so far (viewport + overscan + recently touched, capped
  // by the LRU). Lets callers measure/iterate the working set without forcing the
  // whole dataset to materialize.
  const getCachedRows = (): Row<TData>[] => Array.from(cache.values());

  return { rows: proxy, getRowAt, getCachedRows };
}

/**
 * Drop-in for `getCoreRowModel()` that returns a lazy row model. Same `memo`
 * dependency (`[data]`): a new data reference is a fresh generation whose cache
 * is discarded, so edits never leak rows. `rowsById` resolves lazily via an
 * id→index map built on first access (over plain data, not `Row` objects).
 */
export function getLazyCoreRowModel<TData extends RowData>(): (
  table: Table<TData>,
) => () => RowModel<TData> {
  return (table) =>
    memo(
      () => [table.options.data],
      (data): LazyRowModel<TData> => {
        const { rows, getRowAt, getCachedRows } = createLazyRows(table, data);

        let idIndex: Map<string, number> | null = null;
        const getIdIndex = (): Map<string, number> => {
          if (idIndex) return idIndex;
          const map = new Map<string, number>();
          for (let i = 0; i < data.length; i++) {
            map.set(table._getRowId(data[i], i, undefined), i);
          }
          idIndex = map;
          return map;
        };

        const rowsById = new Proxy({} as Record<string, Row<TData>>, {
          get(_target, key) {
            if (typeof key !== "string")
              return Reflect.get(_target, key) as unknown;
            const index = getIdIndex().get(key);
            return index === undefined ? undefined : getRowAt(index);
          },
          has(_target, key) {
            if (typeof key !== "string") return Reflect.has(_target, key);
            return getIdIndex().has(key);
          },
        });

        return {
          rows,
          flatRows: rows,
          rowsById,
          getMaterializedRows: getCachedRows,
        };
      },
      getMemoOptions(table.options, "debugTable", "getRowModel", () =>
        table._autoResetPageIndex(),
      ),
    );
}

/**
 * Builds a lazy row model that presents `baseModel`'s rows in a given display
 * order, addressed by data index (`orderByDataIndex[displayPos] = dataIndex`)
 * without materializing all rows. Resolving via the core model's index access
 * (`baseModel.rows[i]` → cheap `getRowAt`) avoids `rowsById`, which would build a
 * full id→index map on every new data generation (i.e. every edit while sorted).
 * The caller keeps `orderByDataIndex` consistent with the current data. Used by
 * the lazy sorted row model.
 */
export function createOrderedLazyRowModel<TData extends RowData>(
  baseModel: LazyRowModel<TData>,
  orderByDataIndex: Int32Array,
): LazyRowModel<TData> {
  const length = orderByDataIndex.length;
  const proxy = new Proxy([] as unknown as Row<TData>[], {
    get(_target, key) {
      if (key === "length") return length;
      if (key === Symbol.iterator) {
        return function* () {
          for (let i = 0; i < length; i++) {
            yield baseModel.rows[orderByDataIndex[i]];
          }
        };
      }
      if (typeof key === "string") {
        const pos = Number(key);
        if (Number.isInteger(pos)) {
          if (pos < 0 || pos >= length) return undefined;
          return baseModel.rows[orderByDataIndex[pos]];
        }
      }
      return Reflect.get(_target, key) as unknown;
    },
    has(_target, key) {
      if (typeof key === "string") {
        const pos = Number(key);
        if (Number.isInteger(pos)) return pos >= 0 && pos < length;
      }
      return Reflect.has(_target, key);
    },
  });

  // Materialized rows live in the underlying core model (shared by id); forward
  // its accessor so measuring the working set still works under an active sort.
  return {
    rows: proxy,
    flatRows: proxy,
    rowsById: baseModel.rowsById,
    getMaterializedRows: baseModel.getMaterializedRows,
  };
}

/**
 * Core row model that adapts per render to data size: standard `getCoreRowModel`
 * for small tables, the lazy model once past the threshold. Both inner models
 * are instantiated once and memoized on `[data]`; the wrapper just picks which to
 * evaluate, so crossing the threshold needs no remount.
 */
export function getAdaptiveCoreRowModel<TData extends RowData>(): (
  table: Table<TData>,
) => () => RowModel<TData> {
  return (table) => {
    const standard = getCoreRowModel<TData>()(table);
    const lazy = getLazyCoreRowModel<TData>()(table);
    return () => (isLazyRowModel(table) ? lazy() : standard());
  };
}
