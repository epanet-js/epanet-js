import clsx from "clsx";
import { useCallback } from "react";
import {
  normalizeNumericInput,
  parseNumericInput,
} from "src/components/form/numeric-input-utils";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import { CellProps, GridColumn } from "../types";
import { useEditableTextInput } from "./use-editable-text-input";

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(Math.trunc(value));
}

type IntegerCellProps = CellProps<number | null> & {
  nullValue?: number | null;
  readonly?: boolean;
  placeholder?: string;
};

const INTEGER_QUICK_NAV_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Tab",
] as const;

export function IntegerCell({
  value,
  editMode,
  onChange,
  stopEditing,
  nullValue = null,
  readonly,
  placeholder,
}: IntegerCellProps) {
  const parse = useCallback(
    (raw: string): number | null | undefined => {
      const parsed = parseNumericInput(raw);
      if (parsed !== null) return Math.trunc(parsed);
      if (raw.trim() === "") return nullValue;
      return undefined;
    },
    [nullValue],
  );

  const format = useCallback((v: number | null) => formatInteger(v), []);

  const {
    inputRef,
    editValue,
    setEditValue,
    hasError,
    setHasError,
    committedDisplay,
    handleBlur,
    handleKeyDown,
  } = useEditableTextInput<number | null>({
    value,
    editMode,
    onChange,
    stopEditing,
    parse,
    format,
    quickNavKeys: INTEGER_QUICK_NAV_KEYS,
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const newValue = normalizeNumericInput(rawValue);
      if (newValue === editValue) return;
      if (rawValue.length > 0 && newValue.length === 0) return;
      setEditValue(newValue);
      setHasError(
        newValue.trim() !== "" && parseNumericInput(newValue) === null,
      );
    },
    [editValue, setEditValue, setHasError],
  );

  const formattedValue = formatInteger(value);
  const baseDisplay = !editMode && value === null ? "" : formattedValue;
  const displayValue =
    !editMode && committedDisplay !== null ? committedDisplay : baseDisplay;

  if (readonly) {
    return (
      <div className="w-full h-full flex items-center px-2 text-size-base tabular-nums text-subtle bg-panel">
        {value === null && placeholder != null ? (
          <span className="italic">{placeholder}</span>
        ) : (
          formattedValue
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "w-full h-full flex items-center",
        hasError &&
          editMode &&
          "z-2 bg-orange-100 dark:bg-orange-900/30 ring-1 ring-orange-500 dark:ring-orange-700",
      )}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={editMode ? editValue : displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={!editMode}
        className={clsx(
          "w-full px-2 text-size-base tabular-nums outline-hidden border-none ring-0 focus:outline-hidden focus:ring-0 bg-transparent truncate placeholder:italic placeholder:text-subtle",
          !editMode && "mousetrap pointer-events-none",
        )}
      />
    </div>
  );
}

export function integerColumn<TData extends RowData = RowData>(
  accessorKey: Extract<keyof TData, string> & string,
  options: {
    header: string;
    size?: number;
    deleteValue?: number | null;
    nullValue?: number | null;
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    placeholder?: string;
  },
): GridColumn<TData> {
  const { nullValue, isReadOnly: readonly, placeholder } = options;
  const isStaticReadOnly = readonly === true;
  const isDynamicReadOnly = typeof readonly === "function";
  const resolveReadOnly = (rowIndex: number) =>
    typeof readonly === "function" ? readonly(rowIndex) : (readonly ?? false);

  const CellComponent =
    nullValue !== undefined ||
    isStaticReadOnly ||
    isDynamicReadOnly ||
    placeholder !== undefined
      ? (props: CellProps<number | null>) => (
          <IntegerCell
            {...props}
            nullValue={nullValue}
            readonly={resolveReadOnly(props.rowIndex)}
            placeholder={placeholder}
          />
        )
      : IntegerCell;

  const column: ColumnDef<TData, number | null> = {
    accessorKey,
    header: options.header,
    size: options.size,
    meta: {
      cellComponent: CellComponent,
      copyValue: (v) => formatInteger(v),
      pasteValue: (v) => {
        const parsed = parseNumericInput(v);
        if (parsed === null) return nullValue ?? null;
        return Math.trunc(parsed);
      },
      deleteValue: options.deleteValue ?? null,
      placeholder,
      isReadOnly: readonly,
    },
  };
  return column as GridColumn<TData>;
}
