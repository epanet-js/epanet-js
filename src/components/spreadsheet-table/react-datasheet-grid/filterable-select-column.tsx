import { CellComponent, Column } from "react-datasheet-grid";
import {
  FilterableSelector,
  FilterableSelectorOption,
} from "src/components/form/filterable-selector";
import { useCallback, useLayoutEffect, useRef } from "react";

type FilterableSelectCellProps<T extends string | number = string | number> = {
  options: FilterableSelectorOption<T>[];
  placeholder: string;
};

const FilterableSelectCell: CellComponent<
  string | number | null,
  FilterableSelectCellProps<string | number>
> = ({ rowData, setRowData, focus, stopEditing, columnData }) => {
  const { options, placeholder } = columnData;
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (newValue: string | number | null) => {
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

export const createFilterableSelectColumn = <
  T extends string | number,
>(options: {
  options: FilterableSelectorOption<T>[];
  placeholder?: string;
  deleteValue?: T | null;
}): Partial<Column<T | null, FilterableSelectCellProps<T>>> => ({
  component: FilterableSelectCell as CellComponent<
    T | null,
    FilterableSelectCellProps<T>
  >,
  columnData: {
    options: options.options,
    placeholder: options.placeholder ?? "",
  },
  copyValue: ({ rowData }) => String(rowData ?? ""),
  pasteValue: ({ value }) => {
    const match = options.options.find(
      (opt) =>
        String(opt.value) === value ||
        opt.label.toLowerCase() === value.toLowerCase(),
    );
    return match ? match.value : null;
  },
  deleteValue: () => options.deleteValue ?? null,
  disableKeys: true,
});
