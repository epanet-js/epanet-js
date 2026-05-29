import clsx from "clsx";
import { useCallback } from "react";
import {
  normalizeNumericInput,
  parseNumericInput,
} from "src/components/form/numeric-input-utils";
import { localizeDecimal } from "src/infra/i18n/numbers";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import { CellProps, GridColumn } from "../types";
import { useEditableTextInput } from "./use-editable-text-input";

function formatLocaleNumber(
  value: number | null | undefined,
  decimals = 9,
): string {
  if (value === null || value === undefined) return "";
  return localizeDecimal(value, { decimals });
}

type FloatCellProps = CellProps<number | null> & {
  nullValue?: number | null;
  decimals?: number;
  readonly?: boolean;
  placeholder?: string;
};

const FLOAT_QUICK_NAV_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Tab",
] as const;

export function FloatCell({
  value,
  editMode,
  onChange,
  stopEditing,
  nullValue = null,
  decimals,
  readonly,
  placeholder,
}: FloatCellProps) {
  const parse = useCallback(
    (raw: string): number | null | undefined => {
      const parsed = parseNumericInput(raw);
      if (parsed !== null) return parsed;
      if (raw.trim() === "") return nullValue;
      return undefined;
    },
    [nullValue],
  );

  const format = useCallback(
    (v: number | null) => (v === null ? "" : formatLocaleNumber(v, decimals)),
    [decimals],
  );

  const formatForEdit = useCallback(
    (v: number | null) => formatLocaleNumber(v),
    [],
  );

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
    formatForEdit,
    quickNavKeys: FLOAT_QUICK_NAV_KEYS,
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const newValue = normalizeNumericInput(rawValue, {
        allowExponentSign: true,
      });
      if (newValue === editValue) return;
      if (rawValue.length > 0 && newValue.length === 0) return;
      setEditValue(newValue);
      setHasError(
        newValue.trim() !== "" && parseNumericInput(newValue) === null,
      );
    },
    [editValue, setEditValue, setHasError],
  );

  const formattedValue = formatLocaleNumber(value, decimals);
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
        inputMode="decimal"
        value={editMode ? editValue : displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={!editMode}
        className={clsx(
          "w-full px-2 text-size-base tabular-nums outline-hidden border-none ring-0 focus:outline-hidden focus:ring-0 bg-transparent truncate placeholder:italic placeholder:text-gray-400",
          // Mousetrap forces availability of global hot keys when not editing
          // pointer-events-none prevents text selection highlight when not editing
          !editMode && "mousetrap pointer-events-none",
        )}
      />
    </div>
  );
}

export function floatColumn<TData extends RowData = RowData>(
  accessorKey: Extract<keyof TData, string> & string,
  options: {
    header: string;
    size?: number;
    deleteValue?: number | null;
    nullValue?: number | null;
    decimals?: number;
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    placeholder?: string;
  },
): GridColumn<TData> {
  const { nullValue, decimals, isReadOnly: readonly, placeholder } = options;
  const isStaticReadOnly = readonly === true;
  const isDynamicReadOnly = typeof readonly === "function";
  const resolveReadOnly = (rowIndex: number) =>
    typeof readonly === "function" ? readonly(rowIndex) : (readonly ?? false);

  const CellComponent =
    nullValue !== undefined ||
    decimals !== undefined ||
    isStaticReadOnly ||
    isDynamicReadOnly ||
    placeholder !== undefined
      ? (props: CellProps<number | null>) => (
          <FloatCell
            {...props}
            nullValue={nullValue}
            decimals={decimals}
            readonly={resolveReadOnly(props.rowIndex)}
            placeholder={placeholder}
          />
        )
      : FloatCell;

  const column: ColumnDef<TData, number | null> = {
    accessorKey,
    header: options.header,
    size: options.size,
    meta: {
      cellComponent: CellComponent,
      copyValue: (v) => formatLocaleNumber(v, decimals),
      pasteValue: (v) => parseNumericInput(v) ?? nullValue ?? null,
      deleteValue: options.deleteValue ?? null,
      placeholder,
      isReadOnly: readonly,
    },
  };
  return column as GridColumn<TData>;
}
