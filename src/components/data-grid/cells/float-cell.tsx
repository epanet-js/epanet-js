import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeNumericInput,
  parseNumericInput,
} from "src/components/form/numeric-input-utils";
import { CellProps, GridColumn } from "../types";

function formatLocaleNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";

  const strValue = value.toString();
  const decimalIndex = strValue.indexOf(".");
  const decimalPlaces =
    decimalIndex >= 0 ? strValue.length - decimalIndex - 1 : 0;

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    useGrouping: true,
  }).format(value);
}

type FloatCellProps = CellProps<number | null> & {
  nullValue?: number | null;
};

export function FloatCell({
  value,
  editMode,
  onChange,
  stopEditing,
  nullValue = null,
}: FloatCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState("");
  const shouldCommitOnBlurRef = useRef(false);

  useEffect(() => {
    if (editMode) {
      shouldCommitOnBlurRef.current = true;
      setEditValue(formatLocaleNumber(value));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editMode, value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const newValue = normalizeNumericInput(rawValue, {
        allowExponentSign: true,
      });
      if (newValue === editValue) return;
      if (rawValue.length > 0 && newValue.length === 0) return;
      setEditValue(newValue);
    },
    [editValue],
  );

  const commit = useCallback(() => {
    const parsed = parseNumericInput(editValue);
    if (parsed !== null) {
      onChange(parsed);
    } else if (editValue.trim() === "") {
      onChange(nullValue);
    }
  }, [editValue, onChange, nullValue]);

  const handleBlur = useCallback(() => {
    if (!shouldCommitOnBlurRef.current) return;
    shouldCommitOnBlurRef.current = false;
    commit();
  }, [commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        shouldCommitOnBlurRef.current = false;
        stopEditing();
      } else if (
        editMode === "quick" &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(
          e.key,
        )
      ) {
        commit();
      }
    },
    [editMode, commit, stopEditing],
  );

  const formattedValue = formatLocaleNumber(value);

  return (
    <div className="w-full h-full flex items-center">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={editMode ? editValue : formattedValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={!editMode}
        className="w-full px-2 text-sm tabular-nums outline-none border-none ring-0 focus:outline-none focus:ring-0 bg-transparent truncate"
      />
    </div>
  );
}

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
