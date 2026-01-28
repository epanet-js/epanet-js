import { useCallback, useEffect, useRef } from "react";
import {
  FilterableSelector,
  FilterableSelectorOption,
} from "src/components/form/filterable-selector";
import { SpreadsheetCellProps, SpreadsheetColumn } from "../types";

type FilterableSelectCellExtraProps<
  T extends string | number = string | number,
> = {
  options: FilterableSelectorOption<T>[];
  placeholder: string;
};

export function FilterableSelectCell({
  value,
  onChange,
  stopEditing,
  focus,
  options,
  placeholder,
}: SpreadsheetCellProps<string | number | null> &
  FilterableSelectCellExtraProps<string | number>) {
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (newValue: string | number | null) => {
      onChange(newValue);
      stopEditing();
    },
    [onChange, stopEditing],
  );

  useEffect(() => {
    if (focus) {
      ref.current?.focus();
      ref.current?.select();
    } else {
      ref.current?.blur();
    }
  }, [focus]);

  return (
    <div
      className="w-full h-full [&>div]:w-full [&>div]:h-full [&_input]:w-full [&_input]:h-full [&_input]:cursor-cell [&_input:focus]:cursor-text"
      style={{ pointerEvents: focus ? "auto" : "none" }}
    >
      <FilterableSelector
        ref={ref}
        options={options}
        selected={value}
        onChange={handleChange}
        placeholder={placeholder}
        styleOptions={{
          border: false,
          textSize: "text-sm",
          paddingX: 2,
          paddingY: 0,
          disableFocusStyles: true,
        }}
        tabIndex={-1}
      />
    </div>
  );
}

/**
 * Creates a filterable select (searchable dropdown) column.
 *
 * @example
 * filterableSelectColumn("pattern", {
 *   header: "Pattern",
 *   size: 120,
 *   options: [{ value: "pat1", label: "Pattern 1" }],
 * })
 */
export function filterableSelectColumn<T extends string | number = string>(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    options: FilterableSelectorOption<T>[];
    placeholder?: string;
    deleteValue?: T | null;
  },
): SpreadsheetColumn {
  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: (props: SpreadsheetCellProps<string | number | null>) => (
      <FilterableSelectCell
        {...props}
        options={options.options as FilterableSelectorOption<string | number>[]}
        placeholder={options.placeholder ?? ""}
      />
    ),
    copyValue: (v) => String(v ?? ""),
    pasteValue: (v) => {
      const match = options.options.find(
        (opt) =>
          String(opt.value) === v ||
          opt.label.toLowerCase() === v.toLowerCase(),
      );
      return match ? match.value : null;
    },
    deleteValue: options.deleteValue ?? null,
    disableKeys: true,
  };
}
