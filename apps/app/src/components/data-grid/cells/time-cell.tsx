import clsx from "clsx";
import { useCallback } from "react";
import type { RowData } from "@tanstack/react-table";
import {
  formatSecondsToDisplay,
  parseValueToSeconds,
} from "src/components/form/time-field";
import { CellProps, GridColumn } from "../types";
import { type ColumnKey, resolveColumnKey } from "./column-key";
import { useEditableTextInput } from "./use-editable-text-input";

const TIME_QUICK_NAV_KEYS = ["ArrowUp", "ArrowDown", "Tab"] as const;

const sanitizeTimeInput = (raw: string) => raw.replace(/[^0-9:.,]/g, "");

type TimeCellProps = CellProps<number | null> & {
  emptyValue?: number | null;
  readonly?: boolean;
  placeholder?: string;
  validate?: (value: number, rowIndex: number) => boolean;
};

export function TimeCell({
  value,
  rowIndex,
  editMode,
  onChange,
  stopEditing,
  emptyValue = null,
  readonly,
  placeholder,
  validate,
}: TimeCellProps) {
  const parse = useCallback(
    (raw: string): number | null | undefined => {
      if (raw.trim() === "") return emptyValue;
      const seconds = parseValueToSeconds(raw);
      if (seconds === undefined) return undefined;
      if (validate && !validate(seconds, rowIndex)) return undefined;
      return seconds;
    },
    [emptyValue, validate, rowIndex],
  );

  const format = useCallback(
    (v: number | null) => (v === null ? "" : formatSecondsToDisplay(v)),
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
    quickNavKeys: TIME_QUICK_NAV_KEYS,
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = sanitizeTimeInput(e.target.value);
      setEditValue(newValue);
      const isEmpty = newValue.trim() === "";
      const seconds = parseValueToSeconds(newValue);
      const isInvalid = !isEmpty && seconds === undefined;
      const failsValidation =
        seconds !== undefined &&
        validate !== undefined &&
        !validate(seconds, rowIndex);
      setHasError(isInvalid || failsValidation);
    },
    [setEditValue, setHasError, validate, rowIndex],
  );

  const formattedValue = value === null ? "" : formatSecondsToDisplay(value);
  const displayValue =
    !editMode && committedDisplay !== null ? committedDisplay : formattedValue;

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

export function timeColumn<TData extends RowData = RowData>(
  key: ColumnKey<TData, number | null>,
  options: {
    header: string;
    size?: number;
    emptyValue?: number | null;
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    placeholder?: string;
    validate?: (value: number, rowIndex: number) => boolean;
  },
): GridColumn<TData> {
  const { emptyValue = null, isReadOnly, placeholder, validate } = options;
  const resolveReadOnly = (rowIndex: number) =>
    typeof isReadOnly === "function"
      ? isReadOnly(rowIndex)
      : (isReadOnly ?? false);

  const CellComponent = (props: CellProps<number | null>) => (
    <TimeCell
      {...props}
      emptyValue={emptyValue}
      readonly={resolveReadOnly(props.rowIndex)}
      placeholder={placeholder}
      validate={validate}
    />
  );

  const column = {
    ...resolveColumnKey(key),
    header: options.header,
    size: options.size,
    meta: {
      cellComponent: CellComponent,
      copyValue: (v: number | null) =>
        v === null ? "" : formatSecondsToDisplay(v),
      pasteValue: (v: string) => {
        if (v.trim() === "") return emptyValue;
        return parseValueToSeconds(v);
      },
      deleteValue: emptyValue,
      placeholder,
      isReadOnly,
    },
  };
  return column as GridColumn<TData>;
}
