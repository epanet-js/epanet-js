import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { Column, CellProps } from "react-datasheet-grid";

type FloatColumnOptions = {
  deleteValue?: number | null;
};

type FloatCellProps = CellProps<number | null, FloatColumnOptions>;

/**
 * Custom float cell component that commits value only on blur.
 * This prevents input disruption during typing (e.g., when typing decimals).
 */
function FloatCell({
  rowData,
  setRowData,
  focus,
}: FloatCellProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(() =>
    typeof rowData === "number" ? String(rowData) : "",
  );

  // Track if the user has made changes since focus
  const hasChangedRef = useRef(false);

  // When focus changes, handle value commit and input setup
  useLayoutEffect(() => {
    if (focus) {
      // Cell gained focus - setup the input
      if (inputRef.current) {
        inputRef.current.value =
          typeof rowData === "number" ? String(rowData) : "";
        inputRef.current.focus();
        inputRef.current.select();
      }
      hasChangedRef.current = false;
    } else {
      // Cell lost focus - commit the value if changed
      if (hasChangedRef.current && inputRef.current) {
        const normalized = inputRef.current.value.replace(",", ".");
        const number = parseFloat(normalized);
        const newValue = !isNaN(number) ? number : null;
        setRowData(newValue);
      }
      if (inputRef.current) {
        inputRef.current.blur();
      }
      hasChangedRef.current = false;
    }
  }, [focus, rowData, setRowData]);

  // Sync display value when rowData changes externally (and not focused)
  useLayoutEffect(() => {
    if (!focus) {
      setInputValue(
        typeof rowData === "number"
          ? new Intl.NumberFormat().format(rowData)
          : "",
      );
    }
  }, [focus, rowData]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, decimal separators, minus sign
    const value = e.target.value.replace(/[^0-9\-.,]/g, "");
    setInputValue(value);
    hasChangedRef.current = true;
  }, []);

  const commitValue = useCallback(() => {
    if (hasChangedRef.current && inputRef.current) {
      const normalized = inputRef.current.value.replace(",", ".");
      const number = parseFloat(normalized);
      const newValue = !isNaN(number) ? number : null;
      setRowData(newValue);
      hasChangedRef.current = false;
    }
  }, [setRowData]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        // Reset to original value
        hasChangedRef.current = false;
        setInputValue(typeof rowData === "number" ? String(rowData) : "");
      } else if (e.key === "Enter" || e.key === "Tab") {
        // Commit value immediately on Enter/Tab
        commitValue();
      }
    },
    [rowData, commitValue],
  );

  return (
    <input
      ref={inputRef}
      className="dsg-input dsg-input-align-right"
      value={inputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ pointerEvents: focus ? "auto" : "none" }}
    />
  );
}

export const createFloatColumn = (
  options?: FloatColumnOptions,
): Partial<Column<number | null, FloatColumnOptions, string>> => ({
  component: FloatCell,
  columnData: options,
  cellClassName: "tabular-nums",
  deleteValue: () => options?.deleteValue ?? null,
  copyValue: ({ rowData }) =>
    typeof rowData === "number" ? String(rowData) : "",
  pasteValue: ({ value }) => {
    const normalized = value.replace(",", ".");
    const number = parseFloat(normalized);
    return !isNaN(number) ? number : null;
  },
  isCellEmpty: ({ rowData }) => rowData === null || rowData === undefined,
});
