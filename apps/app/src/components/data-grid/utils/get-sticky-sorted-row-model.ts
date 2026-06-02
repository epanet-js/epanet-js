import {
  type Row,
  type RowData,
  type RowModel,
  type SortingFn,
  type SortingState,
  type Table,
  getMemoOptions,
  memo,
} from "@tanstack/react-table";

// Forked from @tanstack/table-core's `getSortedRowModel` (v8.17.3).
export function getStickySortedRowModel<TData extends RowData>(): (
  table: Table<TData>,
) => () => RowModel<TData> {
  return (table) => {
    // We track the sorting state by reference, so every `setSorting` call produces a fresh array
    // The cache only survives when only the underlying data has changed.
    let cachedSortRef: SortingState | null = null;
    let cachedOrderIds: string[] | null = null;

    return memo(
      () => [table.getState().sorting, table.getPreSortedRowModel()],
      (sorting, preSorted) => {
        if (!preSorted.rows.length || !sorting?.length) {
          cachedSortRef = null;
          cachedOrderIds = null;
          return preSorted;
        }

        const sortChanged = cachedSortRef !== sorting;

        if (sortChanged || cachedOrderIds === null) {
          const sortedRows = sortRows(preSorted.rows, sorting, table);
          cachedSortRef = sorting;
          cachedOrderIds = sortedRows.map((r) => r.id);
          return buildRowModel(sortedRows, preSorted.rowsById);
        }

        const orderedRows: Row<TData>[] = [];
        const seen = new Set<string>();
        for (const id of cachedOrderIds) {
          const row = preSorted.rowsById[id];
          if (row) {
            orderedRows.push(row);
            seen.add(id);
          }
        }
        for (const row of preSorted.flatRows) {
          if (!seen.has(row.id)) orderedRows.push(row);
        }
        return buildRowModel(orderedRows, preSorted.rowsById);
      },
      getMemoOptions(
        table.options,
        "debugTable",
        "getStickySortedRowModel",
        () => table._autoResetPageIndex(),
      ),
    );
  };
}

function buildRowModel<TData extends RowData>(
  sortedRows: Row<TData>[],
  rowsById: Record<string, Row<TData>>,
): RowModel<TData> {
  const flatRows: Row<TData>[] = [];
  const walk = (rows: Row<TData>[]) => {
    for (const row of rows) {
      flatRows.push(row);
      if (row.subRows?.length) walk(row.subRows);
    }
  };
  walk(sortedRows);
  return { rows: sortedRows, flatRows, rowsById };
}

// Verbatim port of the upstream tanstack sort
function sortRows<TData extends RowData>(
  rows: Row<TData>[],
  sortingState: SortingState,
  table: Table<TData>,
): Row<TData>[] {
  const availableSorting = sortingState.filter((sort) =>
    table.getColumn(sort.id)?.getCanSort(),
  );

  const columnInfoById: Record<
    string,
    {
      sortUndefined?: false | -1 | 1 | "first" | "last";
      invertSorting?: boolean;
      sortingFn: SortingFn<TData>;
    }
  > = {};

  availableSorting.forEach((sortEntry) => {
    const column = table.getColumn(sortEntry.id);
    if (!column) return;
    columnInfoById[sortEntry.id] = {
      sortUndefined: column.columnDef.sortUndefined,
      invertSorting: column.columnDef.invertSorting,
      sortingFn: column.getSortingFn(),
    };
  });

  const sortData = (input: Row<TData>[]): Row<TData>[] => {
    const sortedData = input.map((row) => ({ ...row }));
    sortedData.sort((rowA, rowB) => {
      for (let i = 0; i < availableSorting.length; i++) {
        const sortEntry = availableSorting[i];
        const columnInfo = columnInfoById[sortEntry.id];
        const sortUndefined = columnInfo.sortUndefined;
        const isDesc = sortEntry?.desc ?? false;

        let sortInt = 0;

        if (sortUndefined) {
          const aValue = rowA.getValue(sortEntry.id);
          const bValue = rowB.getValue(sortEntry.id);
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
          sortInt = columnInfo.sortingFn(rowA, rowB, sortEntry.id);
        }

        if (sortInt !== 0) {
          if (isDesc) sortInt *= -1;
          if (columnInfo.invertSorting) sortInt *= -1;
          return sortInt;
        }
      }
      return rowA.index - rowB.index;
    });

    sortedData.forEach((row) => {
      if (row.subRows?.length) {
        row.subRows = sortData(row.subRows);
      }
    });

    return sortedData;
  };

  return sortData(rows);
}
