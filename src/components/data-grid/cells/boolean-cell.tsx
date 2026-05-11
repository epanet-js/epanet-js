import { useCallback, useEffect, useRef } from "react";
import { CellProps, GridColumn } from "../types";

export function BooleanCell({
  value,
  isActive,
  readOnly,
  onChange,
}: CellProps<boolean | null>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    function syncCellIsActive() {
      if (isActive) {
        inputRef.current?.focus();
      }
    },
    [isActive],
  );

  const toggle = useCallback(() => {
    if (readOnly) return;
    onChange(!value);
  }, [value, readOnly, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    },
    [toggle],
  );

  return (
    <div className="w-full h-full flex items-center justify-center">
      <input
        ref={inputRef}
        type="checkbox"
        tabIndex={-1}
        checked={!!value}
        disabled={readOnly}
        onChange={toggle}
        onKeyDown={handleKeyDown}
        className={`w-4 h-4 text-purple-400 border-gray-300 rounded ${
          readOnly
            ? "cursor-not-allowed bg-gray-200 opacity-50"
            : "cursor-pointer bg-gray-50 focus:ring-purple-500"
        }`}
      />
    </div>
  );
}

export function booleanColumn(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    isReadOnly?: boolean;
  },
): GridColumn {
  const { isReadOnly } = options;
  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: (props: CellProps<boolean | null>) => (
      <BooleanCell {...props} readOnly={isReadOnly || props.readOnly} />
    ),
    autoSizeExtraWidth: 16, // checkbox w-4
    copyValue: (v) => (v === true ? "TRUE" : v === false ? "FALSE" : ""),
    pasteValue: (v) => {
      const lower = v.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
      return null;
    },
    deleteValue: false,
    ...(isReadOnly ? { disabled: true, disableKeys: true } : {}),
    sortingFn: (rowA, rowB, columnId) => {
      const a = rowA.getValue(columnId) ? 1 : 0;
      const b = rowB.getValue(columnId) ? 1 : 0;
      return a - b;
    },
  };
}
