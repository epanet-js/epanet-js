import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";
import type { ColumnDef, RowData } from "@tanstack/react-table";
import { CellProps, GridColumn } from "../types";
import { useEditableTextInput } from "./use-editable-text-input";

const VALIDATION_DEBOUNCE_MS = 150;

type TextCellProps = CellProps<string | null> & {
  readonly?: boolean;
  validate?: (value: string, rowIndex: number) => boolean;
  allowedChars?: RegExp;
  maxByteLength?: number;
  maxLength?: number;
};

function filterInput(
  raw: string,
  allowedChars?: RegExp,
  maxByteLength?: number,
  maxLength?: number,
): string {
  let next = raw;
  if (allowedChars) {
    next = next
      .split("")
      .filter((char) => allowedChars.test(char))
      .join("");
  }
  if (maxByteLength !== undefined) {
    const encoder = new TextEncoder();
    while (encoder.encode(next).length > maxByteLength) {
      next = next.slice(0, -1);
    }
  }
  if (maxLength !== undefined && next.length > maxLength) {
    next = next.slice(0, maxLength);
  }
  return next;
}

export function TextCell({
  value,
  rowIndex,
  editMode,
  onChange,
  stopEditing,
  readonly,
  validate,
  allowedChars,
  maxByteLength,
  maxLength,
}: TextCellProps) {
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValid = useCallback(
    (v: string) => !validate || v === "" || validate(v, rowIndex),
    [validate, rowIndex],
  );

  const parse = useCallback(
    (raw: string): string | null | undefined => {
      if (!isValid(raw)) return undefined;
      return raw || null;
    },
    [isValid],
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
      const newValue = filterInput(
        e.target.value,
        allowedChars,
        maxByteLength,
        maxLength,
      );
      setEditValue(newValue);

      if (validate) {
        if (validationTimerRef.current)
          clearTimeout(validationTimerRef.current);
        validationTimerRef.current = setTimeout(() => {
          setHasError(newValue !== "" && !validate(newValue, rowIndex));
        }, VALIDATION_DEBOUNCE_MS);
      }
    },
    [
      validate,
      rowIndex,
      setEditValue,
      setHasError,
      allowedChars,
      maxByteLength,
      maxLength,
    ],
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
        hasError &&
          editMode &&
          "z-2 bg-orange-100 dark:bg-orange-900/30 ring-1 ring-orange-500 dark:ring-orange-700",
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
  accessorKey: Extract<keyof TData, string> & string,
  options: {
    header: string;
    size?: number;
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    validate?: (value: string, rowIndex: number) => boolean;
    allowedChars?: RegExp;
    maxByteLength?: number;
    maxLength?: number;
  },
): GridColumn<TData> {
  const { isReadOnly, validate, allowedChars, maxByteLength, maxLength } =
    options;
  const resolveReadOnly = (rowIndex: number) =>
    typeof isReadOnly === "function"
      ? isReadOnly(rowIndex)
      : (isReadOnly ?? false);

  const CellComponent =
    isReadOnly ||
    validate ||
    allowedChars ||
    maxByteLength !== undefined ||
    maxLength !== undefined
      ? (props: CellProps<string | null>) => (
          <TextCell
            {...props}
            readonly={resolveReadOnly(props.rowIndex)}
            validate={validate}
            allowedChars={allowedChars}
            maxByteLength={maxByteLength}
            maxLength={maxLength}
          />
        )
      : TextCell;

  const column: ColumnDef<TData, string | null> = {
    accessorKey,
    header: options.header,
    size: options.size,
    meta: {
      cellComponent: CellComponent,
      copyValue: (v) => v ?? "",
      pasteValue: (v) => {
        if (!v) return null;
        const filtered = filterInput(v, allowedChars, maxByteLength, maxLength);
        return filtered || null;
      },
      deleteValue: null,
      isReadOnly,
    },
  };
  return column as GridColumn<TData>;
}
