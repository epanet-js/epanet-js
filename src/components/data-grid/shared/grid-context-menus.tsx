import * as CM from "@radix-ui/react-context-menu";
import clsx from "clsx";
import { CMContent, CMItem } from "src/components/elements";
import { CopyIcon, ClipboardPasteIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import {
  CellContextAction,
  GutterContextAction,
  GridSelection,
} from "../types";

export type CellContextMenuConfig<TData extends Record<string, unknown>> = {
  actions: CellContextAction<TData>[];
  selection: GridSelection | null;
  getSortedRows: () => TData[];
  onCopy: () => void;
  onPaste: () => void;
  readOnly: boolean;
};

export type GutterContextMenuConfig<TData extends Record<string, unknown>> = {
  actions: GutterContextAction<TData>[];
  selection: GridSelection | null;
  getSortedRows: () => TData[];
};

const itemClassName = (isDisabled: boolean) =>
  clsx({ "opacity-50 cursor-not-allowed": isDisabled });

export function CellContextMenuContent<TData extends Record<string, unknown>>({
  actions,
  selection,
  getSortedRows,
  onCopy,
  onPaste,
  readOnly,
}: CellContextMenuConfig<TData>) {
  const sortedRows = getSortedRows();
  const translate = useTranslate();
  if (!selection) return null;

  return (
    <CM.Portal>
      <CMContent>
        <CMItem onSelect={() => onCopy()}>
          <CopyIcon />
          {translate("copy")}
        </CMItem>
        <CMItem
          disabled={readOnly}
          className={itemClassName(readOnly)}
          onSelect={() => {
            if (readOnly) return;
            onPaste();
          }}
        >
          <ClipboardPasteIcon />
          {translate("paste")}
        </CMItem>
        {actions.length > 0 && (
          <CM.Separator className="border-t border-gray-100 dark:border-gray-700 my-1" />
        )}
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
                onSelect(selection, sortedRows);
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

export function GutterContextMenuContent<
  TData extends Record<string, unknown>,
>({
  actions,
  selection,
  getSortedRows,
  rowIndex,
}: GutterContextMenuConfig<TData> & { rowIndex: number }) {
  if (!selection) return null;
  const sortedRows = getSortedRows();
  if (actions.length === 0) return null;

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
                action.onSelect(selection, sortedRows);
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
