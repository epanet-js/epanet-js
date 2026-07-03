import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";
import type { RowData } from "@tanstack/react-table";
import { CellProps, GridColumn } from "../types";
import { type ColumnKey, resolveColumnKey } from "./column-key";
import { useEditableTextInput } from "./use-editable-text-input";

const VALIDATION_DEBOUNCE_MS = 150;

type TextCellProps<TData = unknown> = CellProps<string | null> & {
  emptyValue?: string | null;
  readonly?: boolean;
  validate?: (value: string, row: TData) => boolean;
  sanitize?: (raw: string) => string;
};

export function TextCell<TData = unknown>({
  value,
  row,
  editMode,
  onChange,
  stopEditing,
  emptyValue,
  readonly,
  validate,
  sanitize,
}: TextCellProps<TData>) {
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValid = useCallback(
    (v: string) => !validate || v === "" || validate(v, row as TData),
    [validate, row],
  );

  const parse = useCallback(
    (raw: string): string | null | undefined => {
      if (!isValid(raw)) return undefined;
      if (raw === "") return emptyValue;
      return raw;
    },
    [isValid, emptyValue],
  );

  const format = useCallback((v: string | null) => v ?? "", []);

  const {
    inputRef,
    editValue,
    setEditValue,
    hasError,
    setHasError,
    committedDisplay,
    handleBlur,
    handleKeyDown,
  } = useEditableTextInput<string | null>({
    value,
    editMode,
    onChange,
    stopEditing,
    parse,
    format,
  });

  useEffect(() => {
    return () => {
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = sanitize ? sanitize(e.target.value) : e.target.value;
      setEditValue(newValue);

      if (validate) {
        if (validationTimerRef.current)
          clearTimeout(validationTimerRef.current);
        validationTimerRef.current = setTimeout(() => {
          setHasError(newValue !== "" && !validate(newValue, row as TData));
        }, VALIDATION_DEBOUNCE_MS);
      }
    },
    [validate, row, setEditValue, setHasError, sanitize],
  );

  if (readonly) {
    return (
      <div className="w-full h-full flex items-center px-2 text-size-base tabular-nums text-subtle bg-panel overflow-hidden">
        <span className="truncate">{value ?? ""}</span>
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
        value={editMode ? editValue : (committedDisplay ?? value ?? "")}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={!editMode}
        className={clsx(
          "w-full px-2 text-size-base tabular-nums outline-hidden border-none ring-0 focus:outline-hidden focus:ring-0 bg-transparent truncate",
          // Mousetrap forces availability of global hot keys when not editing
          // pointer-events-none prevents text selection highlight when not editing
          !editMode && "mousetrap pointer-events-none",
        )}
      />
    </div>
  );
}

export function textColumn<TData extends RowData = RowData>(
  key: ColumnKey<TData, string | null>,
  options: {
    header: string;
    size?: number;
    emptyValue?: string | null;
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    validate?: (value: string, row: TData) => boolean;
    cleanLabel?: (raw: string) => string;
  },
): GridColumn<TData> {
  const { emptyValue, isReadOnly, validate, cleanLabel } = options;
  const resolveReadOnly = (rowIndex: number) =>
    typeof isReadOnly === "function"
      ? isReadOnly(rowIndex)
      : (isReadOnly ?? false);

  const CellComponent =
    emptyValue !== undefined || isReadOnly || validate || cleanLabel
      ? (props: CellProps<string | null>) => (
          <TextCell<TData>
            {...props}
            emptyValue={emptyValue}
            readonly={resolveReadOnly(props.rowIndex)}
            validate={validate}
            sanitize={cleanLabel}
          />
        )
      : TextCell;

  const column = {
    ...resolveColumnKey(key),
    header: options.header,
    size: options.size,
    meta: {
      cellComponent: CellComponent,
      copyValue: (v: string | null) => v ?? "",
      pasteValue: (v: string, row: TData) => {
        if (!v) return emptyValue;
        const cleaned = cleanLabel ? cleanLabel(v) : v;
        if (!cleaned) return emptyValue;
        if (validate && !validate(cleaned, row)) return undefined;
        return cleaned;
      },
      deleteValue: emptyValue,
      isReadOnly,
    },
  };
  return column as GridColumn<TData>;
}
