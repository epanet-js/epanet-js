import { useCallback, useEffect, useRef, useState } from "react";
import { SpreadsheetCellProps, SpreadsheetColumnDef } from "../types";

export function FloatCell({
  value,
  isEditing,
  onChange,
  stopEditing,
  focus,
}: SpreadsheetCellProps<number | null>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (isEditing && focus) {
      setEditValue(value?.toString() ?? "");
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, focus, value]);

  const handleBlur = useCallback(() => {
    if (isEditing) {
      const parsed = parseFloat(editValue);
      onChange(isNaN(parsed) ? null : parsed);
      stopEditing();
    }
  }, [isEditing, editValue, onChange, stopEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleBlur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        stopEditing();
      }
    },
    [handleBlur, stopEditing],
  );

  if (isEditing && focus) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 text-sm tabular-nums outline-none border-none bg-transparent"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center px-2 text-sm tabular-nums">
      {value ?? ""}
    </div>
  );
}

/**
 * Creates a float (number) column definition.
 * Use with keyColumn: keyColumn("fieldName", createFloatColumn({ deleteValue: 0 }))
 */
export function createFloatColumn<
  TData extends Record<string, unknown>,
>(options?: {
  deleteValue?: number | null;
}): Partial<SpreadsheetColumnDef<TData, number | null>> {
  return {
    meta: {
      cellComponent: FloatCell,
      copyValue: (v) => v?.toString() ?? "",
      pasteValue: (v) => {
        const parsed = parseFloat(v);
        return isNaN(parsed) ? null : parsed;
      },
      deleteValue: options?.deleteValue ?? null,
    },
  };
}
