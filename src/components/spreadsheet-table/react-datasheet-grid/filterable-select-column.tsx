import { CellComponent, Column } from "react-datasheet-grid";
import {
  FilterableSelector,
  FilterableSelectorOption,
} from "src/components/form/filterable-selector";
import { useCallback, useLayoutEffect, useRef } from "react";

type FilterableSelectColumnOptions = {
  options: FilterableSelectorOption[];
  placeholder?: string;
  deleteValue?: string | null;
};

type FilterableSelectCellProps = {
  options: FilterableSelectorOption[];
  placeholder: string;
};

const FilterableSelectCell: CellComponent<
  string | null,
  FilterableSelectCellProps
> = ({ rowData, setRowData, focus, stopEditing, columnData }) => {
  const { options, placeholder } = columnData;
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (newValue: string | null) => {
      setRowData(newValue);
      stopEditing();
    },
    [setRowData, stopEditing],
  );

  // Focus management following library's textColumn pattern
  useLayoutEffect(() => {
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
        selected={rowData}
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
};

export const createFilterableSelectColumn = (
  options: FilterableSelectColumnOptions,
): Partial<Column<string | null, FilterableSelectCellProps>> => ({
  component: FilterableSelectCell,
  columnData: {
    options: options.options,
    placeholder: options.placeholder ?? "",
  },
  copyValue: ({ rowData }) => rowData ?? "",
  pasteValue: ({ value }) => {
    const match = options.options.find(
      (opt) =>
        opt.value === value || opt.label.toLowerCase() === value.toLowerCase(),
    );
    return match ? match.value : null;
  },
  deleteValue: () => options.deleteValue ?? null,
  disableKeys: true,
});
