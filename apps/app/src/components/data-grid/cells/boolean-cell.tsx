import { useCallback, useEffect, useRef } from "react";
import clsx from "clsx";
import type { Row, RowData } from "@tanstack/react-table";
import { CellProps, GridColumn } from "../types";
import { type ColumnKey, resolveColumnKey } from "./column-key";

export function BooleanCell({
  value,
  isActive,
  readOnly,
  onChange,
}: CellProps<boolean | null>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    function syncCellIsActive() {
      if (isActive) {
        inputRef.current?.focus();
      }
    },
    [isActive],
  );

  const toggle = useCallback(() => {
    if (readOnly) return;
    onChange(!value);
  }, [value, readOnly, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    },
    [toggle],
  );

  const handleWrapperMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly) return;
      // Route focus to the checkbox
      e.preventDefault();
      inputRef.current?.focus();
    },
    [readOnly],
  );

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      onMouseDown={handleWrapperMouseDown}
    >
      <input
        ref={inputRef}
        type="checkbox"
        tabIndex={-1}
        checked={!!value}
        disabled={readOnly}
        onChange={toggle}
        onKeyDown={handleKeyDown}
        className={clsx(
          "w-4 h-4 text-accent border-strong rounded-sm outline-hidden focus:ring-0",
          readOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        )}
      />
    </div>
  );
}

export function booleanColumn<TData extends RowData = RowData>(
  key: ColumnKey<TData, boolean | null>,
  options: {
    header: string;
    size?: number;
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
  },
): GridColumn<TData> {
  const { isReadOnly } = options;
  const resolveReadOnly = (rowIndex: number) =>
    typeof isReadOnly === "function"
      ? isReadOnly(rowIndex)
      : (isReadOnly ?? false);
  const column = {
    ...resolveColumnKey(key),
    header: options.header,
    size: options.size,
    sortingFn: (rowA: Row<TData>, rowB: Row<TData>, columnId: string) => {
      const a = rowA.getValue(columnId) ? 1 : 0;
      const b = rowB.getValue(columnId) ? 1 : 0;
      return a - b;
    },
    meta: {
      cellComponent: (props: CellProps<boolean | null>) => (
        <BooleanCell
          {...props}
          readOnly={resolveReadOnly(props.rowIndex) || props.readOnly}
        />
      ),
      copyValue: (v: boolean | null) =>
        v === true ? "TRUE" : v === false ? "FALSE" : "",
      pasteValue: (v: string) => {
        const lower = v.toLowerCase();
        if (lower === "true") return true;
        if (lower === "false") return false;
        return null;
      },
      deleteValue: false,
      autoSizeExtraWidth: 16, // checkbox w-4
      isReadOnly,
    },
  };
  return column as GridColumn<TData>;
}
