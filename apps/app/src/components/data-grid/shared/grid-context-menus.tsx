import * as CM from "@radix-ui/react-context-menu";
import { Table } from "@tanstack/react-table";
import clsx from "clsx";
import { CMContent, CMItem } from "src/components/elements";
import { CopyIcon, ClipboardPasteIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { CellContextAction, GutterContextAction } from "../types";
import { isLazyRowModel } from "../utils/lazy-core-row-model";
import { useGridBusy } from "./grid-busy";

const itemClassName = (isDisabled: boolean) =>
  clsx({ "opacity-50 cursor-not-allowed": isDisabled });

// The full data array in display order. In lazy mode this avoids materializing
// every Row (which `getRowModel().rows.map(r => r.original)` would do).
function orderedOriginals<TData extends Record<string, unknown>>(
  table: Table<TData>,
): TData[] {
  return isLazyRowModel(table)
    ? table.getOrderedOriginals()
    : table.getRowModel().rows.map((r) => r.original);
}

type CellContextMenuContentProps<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  actions: CellContextAction<TData>[];
  readOnly: boolean;
  rowIndex: number;
  colIndex: number;
};

export function CellContextMenuContent<TData extends Record<string, unknown>>({
  table,
  actions,
  readOnly,
  rowIndex,
  colIndex,
}: CellContextMenuContentProps<TData>) {
  const translate = useTranslate();
  const { runBusyAsync } = useGridBusy();
  const selection = table.getSelection();
  if (!selection) return null;
  const sortedRows = orderedOriginals(table);

  const runPaste = () => {
    if (readOnly) return;
    if (isLazyRowModel(table)) {
      runBusyAsync(() => table.pasteSelection());
    } else {
      void table.pasteSelection();
    }
  };

  return (
    <CM.Portal>
      <CMContent>
        <CMItem onSelect={() => void table.copySelection()}>
          <CopyIcon />
          {translate("copy")}
        </CMItem>
        <CMItem
          disabled={readOnly}
          className={itemClassName(readOnly)}
          onSelect={runPaste}
        >
          <ClipboardPasteIcon />
          {translate("paste")}
        </CMItem>
        {actions.length > 0 && <CM.Separator className="border-t my-1" />}
        {actions.map((action, index) => {
          const { disabled, onSelect } = action;
          const isDisabled = disabled ? disabled(selection) : false;
          const variant =
            action.variant === "destructive" ? "destructive" : "default";
          return (
            <CMItem
              key={index}
              disabled={isDisabled}
              className={itemClassName(isDisabled)}
              variant={variant}
              onSelect={() => {
                if (isDisabled) return;
                onSelect(selection, sortedRows, {
                  col: colIndex,
                  row: rowIndex,
                });
              }}
            >
              {action.icon}
              {action.label}
            </CMItem>
          );
        })}
      </CMContent>
    </CM.Portal>
  );
}

export type GridContextMenuTarget =
  | { type: "cell"; rowIndex: number; colIndex: number }
  | { type: "gutter"; rowIndex: number };

type GridContextMenuContentProps<TData extends Record<string, unknown>> = {
  target: GridContextMenuTarget | null;
  table: Table<TData>;
  cellContextActions?: CellContextAction<TData>[];
  gutterContextActions?: GutterContextAction<TData>[];
  readOnly: boolean;
};

export function GridContextMenuContent<TData extends Record<string, unknown>>({
  target,
  table,
  cellContextActions,
  gutterContextActions,
  readOnly,
}: GridContextMenuContentProps<TData>) {
  if (!target) return null;
  if (target.type === "cell" && cellContextActions) {
    return (
      <CellContextMenuContent
        table={table}
        actions={cellContextActions}
        readOnly={readOnly}
        rowIndex={target.rowIndex}
        colIndex={target.colIndex}
      />
    );
  }
  if (target.type === "gutter" && gutterContextActions) {
    return (
      <GutterContextMenuContent
        table={table}
        actions={gutterContextActions}
        rowIndex={target.rowIndex}
      />
    );
  }
  return null;
}

type GutterContextMenuContentProps<TData extends Record<string, unknown>> = {
  table: Table<TData>;
  actions: GutterContextAction<TData>[];
  rowIndex: number;
};

export function GutterContextMenuContent<
  TData extends Record<string, unknown>,
>({ table, actions, rowIndex }: GutterContextMenuContentProps<TData>) {
  const selection = table.getSelection();
  if (!selection) return null;
  if (actions.length === 0) return null;
  const sortedRows = orderedOriginals(table);

  return (
    <CM.Portal>
      <CMContent>
        {actions.map((action, index) => {
          const isDisabled = action.disabled?.(rowIndex) ?? false;
          const variant =
            action.variant === "destructive" ? "destructive" : "default";
          return (
            <CMItem
              key={index}
              disabled={isDisabled}
              className={itemClassName(isDisabled)}
              variant={variant}
              onSelect={() => {
                if (isDisabled) return;
                action.onSelect(selection, sortedRows, rowIndex);
              }}
            >
              {action.icon}
              {action.label}
            </CMItem>
          );
        })}
      </CMContent>
    </CM.Portal>
  );
}
