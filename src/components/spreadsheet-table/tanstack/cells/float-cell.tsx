import { useCallback, useEffect, useRef, useState } from "react";
import { SpreadsheetCellProps, SpreadsheetColumn } from "../types";

// Format number for display using locale-aware formatting
const formatDisplayValue = (value: number | null): string => {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat().format(value);
};

// Normalize input: replace comma with period, filter invalid chars
const normalizeInput = (input: string): string => {
  return input.replace(/[^0-9\-.,]/g, "");
};

// Parse input value: normalize comma to period then parse
const parseInputValue = (input: string): number | null => {
  const normalized = input.replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
};

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
      // Show raw number for editing (not locale-formatted)
      setEditValue(value?.toString() ?? "");
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, focus, value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, decimal separators, minus sign
    setEditValue(normalizeInput(e.target.value));
  }, []);

  const handleBlur = useCallback(() => {
    if (isEditing) {
      onChange(parseInputValue(editValue));
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
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 text-sm tabular-nums outline-none border-none bg-transparent"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center px-2 text-sm tabular-nums">
      {formatDisplayValue(value)}
    </div>
  );
}

/**
 * Creates a float (number) column.
 *
 * @example
 * floatColumn("price", { header: "Price", size: 100, deleteValue: 0 })
 */
export function floatColumn(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    deleteValue?: number | null;
  },
): SpreadsheetColumn {
  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: FloatCell,
    copyValue: (v) => (v as number | null)?.toString() ?? "",
    pasteValue: (v) => {
      const normalized = v.replace(",", ".");
      const parsed = parseFloat(normalized);
      return isNaN(parsed) ? null : parsed;
    },
    deleteValue: options.deleteValue ?? null,
  };
}
