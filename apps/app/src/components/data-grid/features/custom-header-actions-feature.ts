import type {
  Column,
  RowData,
  Table,
  TableFeature,
} from "@tanstack/react-table";

export type CustomHeaderAction = {
  icon: React.ReactNode;
  ariaLabel: string;
  onClick: () => void;
  alwaysVisible?: boolean;
};

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    customHeaderActions?: CustomHeaderAction[];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Column<TData extends RowData, TValue> {
    getCustomHeaderActions: () => CustomHeaderAction[] | undefined;
  }
}

export const CustomHeaderActionsFeature: TableFeature = {
  createColumn: <TData extends RowData>(
    column: Column<TData, unknown>,
    _table: Table<TData>,
  ): void => {
    column.getCustomHeaderActions = () =>
      column.columnDef.meta?.customHeaderActions;
  },
};

export const resolveVisibleHeaderActions = (
  actions: CustomHeaderAction[] | undefined,
  isHovered: boolean,
): CustomHeaderAction[] => {
  if (!actions || actions.length === 0) return [];
  return actions.filter((a) => a.alwaysVisible || isHovered);
};
