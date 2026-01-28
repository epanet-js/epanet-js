import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatNumericDisplay,
  normalizeNumericInput,
  parseNumericInput,
} from "src/components/form/numeric-input-utils";
import { CellProps, GridColumn } from "../types";

type FloatCellProps = CellProps<number | null> & {
  nullValue?: number | null;
};

export function FloatCell({
  value,
  isEditing,
  onChange,
  stopEditing,
  focus,
  nullValue = null,
}: FloatCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (isEditing && focus) {
      setEditValue(value?.toString() ?? "");
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, focus, value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(
      normalizeNumericInput(e.target.value, { allowExponentSign: true }),
    );
  }, []);

  const commit = useCallback(() => {
    const parsed = parseNumericInput(editValue);
    if (parsed !== null) {
      onChange(parsed);
    } else if (editValue.trim() === "") {
      onChange(nullValue);
    }
  }, [editValue, onChange, nullValue]);

  const handleBlur = useCallback(() => {
    if (!isEditing) return;
    commit();
    stopEditing();
  }, [isEditing, commit, stopEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        stopEditing();
      }
    },
    [commit, stopEditing],
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
        className="w-full h-full px-2 text-sm tabular-nums outline-none border-none ring-0 focus:outline-none focus:ring-0 bg-transparent"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center px-2 text-sm tabular-nums">
      {formatNumericDisplay(value)}
    </div>
  );
}

/**
 * Creates a float (number) column.
 *
 * @example
 * floatColumn("price", { header: "Price", size: 100, deleteValue: 0 })
 * floatColumn("quantity", { header: "Qty", nullValue: 0 }) // empty input becomes 0
 */
export function floatColumn(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    deleteValue?: number | null;
    nullValue?: number | null;
  },
): GridColumn {
  const { nullValue } = options;

  const CellComponent =
    nullValue !== undefined
      ? (props: CellProps<number | null>) => (
          <FloatCell {...props} nullValue={nullValue} />
        )
      : FloatCell;

  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: CellComponent,
    copyValue: (v) => (v as number | null)?.toString() ?? "",
    pasteValue: (v) => parseNumericInput(v) ?? nullValue ?? null,
    deleteValue: options.deleteValue ?? null,
  };
}
