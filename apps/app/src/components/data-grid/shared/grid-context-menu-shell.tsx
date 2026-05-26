import { ReactNode } from "react";
import * as CM from "@radix-ui/react-context-menu";
import { Table } from "@tanstack/react-table";
import { CellContextAction, GutterContextAction } from "../types";
import {
  GridContextMenuContent,
  GridContextMenuTarget,
} from "./grid-context-menus";

type Props<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  cellContextActions?: CellContextAction<TData>[];
  gutterContextActions?: GutterContextAction<TData>[];
  readOnly: boolean;
  menuTarget: GridContextMenuTarget | null;
  onClose: () => void;
  children: ReactNode;
};

export function GridContextMenuWrapper<TData extends Record<string, unknown>>({
  table,
  cellContextActions,
  gutterContextActions,
  readOnly,
  menuTarget,
  onClose,
  children,
}: Props<TData>) {
  if (!cellContextActions && !gutterContextActions) return children;

  return (
    <CM.Root
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <CM.Trigger asChild>{children}</CM.Trigger>
      <GridContextMenuContent
        target={menuTarget}
        table={table}
        cellContextActions={cellContextActions}
        gutterContextActions={gutterContextActions}
        readOnly={readOnly}
      />
    </CM.Root>
  );
}
