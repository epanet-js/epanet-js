import clsx from "clsx";
import { useCallback } from "react";
import {
  normalizeNumericInput,
  parseNumericInput,
} from "src/components/form/numeric-input-utils";
import { localizeDecimal } from "src/infra/i18n/numbers";
import type { RowData } from "@tanstack/react-table";
import { CellProps, GridColumn } from "../types";
import { type ColumnKey, resolveColumnKey } from "./column-key";
import { useEditableTextInput } from "./use-editable-text-input";

function formatLocaleNumber(
  value: number | null | undefined,
  decimals = 9,
): string {
  if (value === null || value === undefined) return "";
  return localizeDecimal(value, { decimals });
}

type FloatCellProps = CellProps<number | null> & {
  emptyValue?: number | null;
  validate?: (value: number) => boolean;
  commitInvalidValues?: boolean;
  decimals?: number;
  readonly?: boolean;
  placeholder?: string;
  toDisplay?: (stored: number) => number;
  fromDisplay?: (displayed: number) => number;
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
  emptyValue,
  validate,
  commitInvalidValues = false,
  decimals,
  readonly,
  placeholder,
  toDisplay,
  fromDisplay,
}: FloatCellProps) {
  // Stored value -> the value shown/edited in the cell (identity when no transform).
  const toDisplayValue = useCallback(
    (v: number | null): number | null =>
      v === null || toDisplay === undefined ? v : toDisplay(v),
    [toDisplay],
  );

  const parse = useCallback(
    (raw: string): number | null | undefined => {
      const parsed = parseNumericInput(raw);
      if (parsed !== null) {
        if (!commitInvalidValues && validate && !validate(parsed))
          return undefined;
        return fromDisplay ? fromDisplay(parsed) : parsed;
      }
      if (raw.trim() === "") return emptyValue;
      return undefined;
    },
    [emptyValue, validate, commitInvalidValues, fromDisplay],
  );

  const format = useCallback(
    (v: number | null) =>
      v === null ? "" : formatLocaleNumber(toDisplayValue(v), decimals),
    [decimals, toDisplayValue],
  );

  const formatForEdit = useCallback(
    (v: number | null) => formatLocaleNumber(toDisplayValue(v)),
    [toDisplayValue],
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
      const parsed = parseNumericInput(newValue);
      const isInvalidNumber = newValue.trim() !== "" && parsed === null;
      const failsValidation =
        validate !== undefined && parsed !== null && !validate(parsed);
      setHasError(isInvalidNumber || failsValidation);
    },
    [editValue, validate, setEditValue, setHasError],
  );

  const formattedValue = formatLocaleNumber(toDisplayValue(value), decimals);
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
          "w-full px-2 text-size-base tabular-nums outline-hidden border-none ring-0 focus:outline-hidden focus:ring-0 bg-transparent truncate placeholder:italic placeholder:text-subtle",
          // Mousetrap forces availability of global hot keys when not editing
          // pointer-events-none prevents text selection highlight when not editing
          !editMode && "mousetrap pointer-events-none",
        )}
      />
    </div>
  );
}

export function floatColumn<TData extends RowData = RowData>(
  key: ColumnKey<TData, number | null>,
  options: {
    header: string;
    size?: number;
    emptyValue?: number | null;
    validate?: (value: number) => boolean;
    commitInvalidValues?: boolean;
    decimals?: number;
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    placeholder?: string;
    toDisplay?: (stored: number) => number;
    fromDisplay?: (displayed: number) => number;
  },
): GridColumn<TData> {
  const {
    emptyValue,
    validate,
    commitInvalidValues,
    decimals,
    isReadOnly: readonly,
    placeholder,
    toDisplay,
    fromDisplay,
  } = options;
  const isStaticReadOnly = readonly === true;
  const isDynamicReadOnly = typeof readonly === "function";
  const resolveReadOnly = (rowIndex: number) =>
    typeof readonly === "function" ? readonly(rowIndex) : (readonly ?? false);

  const CellComponent =
    emptyValue !== undefined ||
    validate !== undefined ||
    commitInvalidValues !== undefined ||
    decimals !== undefined ||
    isStaticReadOnly ||
    isDynamicReadOnly ||
    placeholder !== undefined ||
    toDisplay !== undefined ||
    fromDisplay !== undefined
      ? (props: CellProps<number | null>) => (
          <FloatCell
            {...props}
            emptyValue={emptyValue}
            validate={validate}
            commitInvalidValues={commitInvalidValues}
            decimals={decimals}
            readonly={resolveReadOnly(props.rowIndex)}
            placeholder={placeholder}
            toDisplay={toDisplay}
            fromDisplay={fromDisplay}
          />
        )
      : FloatCell;

  const column = {
    ...resolveColumnKey(key),
    header: options.header,
    size: options.size,
    meta: {
      cellComponent: CellComponent,
      copyValue: (v: number | null) =>
        formatLocaleNumber(
          v !== null && toDisplay ? toDisplay(v) : v,
          decimals,
        ),
      pasteValue: (v: string) => {
        const parsed = parseNumericInput(v);
        if (parsed !== null) {
          if (!commitInvalidValues && validate && !validate(parsed))
            return undefined;
          return fromDisplay ? fromDisplay(parsed) : parsed;
        }
        if (v.trim() === "") return emptyValue;
        return undefined;
      },
      deleteValue: emptyValue,
      placeholder,
      isReadOnly: readonly,
    },
  };
  return column as GridColumn<TData>;
}
