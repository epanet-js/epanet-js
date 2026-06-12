import {
  type RowData,
  type Table,
  type TableFeature,
} from "@tanstack/react-table";
import {
  type LazyRowOrder,
  createLazyRowOrderGetter,
} from "../utils/lazy-sticky-sorted-row-model";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Table<TData extends RowData> {
    // Present only when LazyRowModelFeature is registered. Computes the sorted
    // display order (and its inverse) over data indices without materializing
    // Row objects. Identity (nulls) when no sort is active.
    getLazyRowOrder: () => LazyRowOrder;
    // The data array in current display order (no Row objects). For consumers
    // (context menus) that previously did `getRowModel().rows.map(r => r.original)`.
    getOrderedOriginals: () => TData[];
  }
}

export const LazyRowModelFeature: TableFeature = {
  createTable: <TData extends RowData>(table: Table<TData>): void => {
    table.getLazyRowOrder = createLazyRowOrderGetter(table);

    table.getOrderedOriginals = () => {
      const { orderIds } = table.getLazyRowOrder();
      const data = table.options.data;
      if (!orderIds) return data;
      const byId = new Map<string, TData>();
      for (let i = 0; i < data.length; i++) {
        byId.set(table._getRowId(data[i], i, undefined), data[i]);
      }
      const result: TData[] = [];
      for (const id of orderIds) {
        const original = byId.get(id);
        if (original !== undefined) result.push(original);
      }
      return result;
    };
  },
};
