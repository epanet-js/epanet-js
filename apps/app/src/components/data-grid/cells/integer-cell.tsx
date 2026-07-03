import clsx from "clsx";
import { useCallback } from "react";
import {
  normalizeNumericInput,
  parseNumericInput,
} from "src/components/form/numeric-input-utils";
import type { RowData } from "@tanstack/react-table";
import { CellProps, GridColumn } from "../types";
import { type ColumnKey, resolveColumnKey } from "./column-key";
import { useEditableTextInput } from "./use-editable-text-input";

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(Math.trunc(value));
}

type IntegerCellProps = CellProps<number | null> & {
  emptyValue?: number | null;
  validate?: (value: number) => boolean;
  commitInvalidValues?: boolean;
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
  emptyValue,
  validate,
  commitInvalidValues = false,
  readonly,
  placeholder,
}: IntegerCellProps) {
  const parse = useCallback(
    (raw: string): number | null | undefined => {
      const parsed = parseNumericInput(raw);
      if (parsed !== null) {
        const truncated = Math.trunc(parsed);
        if (!commitInvalidValues && validate && !validate(truncated))
          return undefined;
        return truncated;
      }
      if (raw.trim() === "") return emptyValue;
      return undefined;
    },
    [emptyValue, validate, commitInvalidValues],
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
      const parsed = parseNumericInput(newValue);
      const truncated = parsed === null ? null : Math.trunc(parsed);
      const isInvalidNumber = newValue.trim() !== "" && parsed === null;
      const failsValidation =
        validate !== undefined && truncated !== null && !validate(truncated);
      setHasError(isInvalidNumber || failsValidation);
    },
    [editValue, validate, setEditValue, setHasError],
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
        hasError && editMode && "z-2 bg-warning-subtle ring-1 ring-warning",
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
  key: ColumnKey<TData, number | null>,
  options: {
    header: string;
    size?: number;
    emptyValue?: number | null;
    validate?: (value: number) => boolean;
    commitInvalidValues?: boolean;
    required?: boolean;
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    placeholder?: string;
  },
): GridColumn<TData> {
  const {
    emptyValue,
    validate,
    commitInvalidValues,
    required,
    isReadOnly: readonly,
    placeholder,
  } = options;
  const isStaticReadOnly = readonly === true;
  const isDynamicReadOnly = typeof readonly === "function";
  const resolveReadOnly = (rowIndex: number) =>
    typeof readonly === "function" ? readonly(rowIndex) : (readonly ?? false);

  const CellComponent =
    emptyValue !== undefined ||
    validate !== undefined ||
    commitInvalidValues !== undefined ||
    isStaticReadOnly ||
    isDynamicReadOnly ||
    placeholder !== undefined
      ? (props: CellProps<number | null>) => (
          <IntegerCell
            {...props}
            emptyValue={emptyValue}
            validate={validate}
            commitInvalidValues={commitInvalidValues}
            readonly={resolveReadOnly(props.rowIndex)}
            placeholder={placeholder}
          />
        )
      : IntegerCell;

  const column = {
    ...resolveColumnKey(key),
    header: options.header,
    size: options.size,
    meta: {
      cellComponent: CellComponent,
      copyValue: (v: number | null) => formatInteger(v),
      pasteValue: (v: string) => {
        const parsed = parseNumericInput(v);
        if (parsed !== null) {
          const truncated = Math.trunc(parsed);
          if (!commitInvalidValues && validate && !validate(truncated))
            return undefined;
          return truncated;
        }
        if (v.trim() === "") return emptyValue;
        return undefined;
      },
      deleteValue: emptyValue,
      placeholder,
      isReadOnly: readonly,
      ...(required !== undefined
        ? {
            hasWarning: (value: number | null): boolean =>
              value == null ? required : validate ? !validate(value) : false,
          }
        : {}),
    },
  };
  return column as GridColumn<TData>;
}
