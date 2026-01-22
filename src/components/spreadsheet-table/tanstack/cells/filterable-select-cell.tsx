import { useCallback, useEffect, useRef } from "react";
import {
  FilterableSelector,
  FilterableSelectorOption,
} from "src/components/form/filterable-selector";
import { SpreadsheetCellProps, SpreadsheetColumnDef } from "../types";

type FilterableSelectCellExtraProps = {
  options: FilterableSelectorOption[];
  placeholder: string;
};

export function FilterableSelectCell({
  value,
  onChange,
  stopEditing,
  focus,
  options,
  placeholder,
}: SpreadsheetCellProps<string | null> & FilterableSelectCellExtraProps) {
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (newValue: string | null) => {
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
 * Creates a filterable select (searchable dropdown) column definition.
 * Use with keyColumn: keyColumn("fieldName", createFilterableSelectColumn({ options: [...] }))
 */
export function createFilterableSelectColumn<
  TData extends Record<string, unknown>,
>(options: {
  options: FilterableSelectorOption[];
  placeholder?: string;
  deleteValue?: string | null;
}): Partial<SpreadsheetColumnDef<TData, string | null>> {
  return {
    meta: {
      cellComponent: (props: SpreadsheetCellProps<string | null>) => (
        <FilterableSelectCell
          {...props}
          options={options.options}
          placeholder={options.placeholder ?? ""}
        />
      ),
      copyValue: (v) => v ?? "",
      pasteValue: (v) => {
        const match = options.options.find(
          (opt) =>
            opt.value === v || opt.label.toLowerCase() === v.toLowerCase(),
        );
        return match ? match.value : null;
      },
      deleteValue: options.deleteValue ?? null,
      disableKeys: true,
    },
  };
}
