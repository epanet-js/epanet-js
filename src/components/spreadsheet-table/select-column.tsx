import { CellComponent, Column } from "react-datasheet-grid";
import { Selector } from "src/components/form/selector";
import { useCallback, useMemo } from "react";
import { useSpreadsheetContext } from "./spreadsheet-context";

type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type SelectColumnOptions<T extends string = string> = {
  options: SelectOption<T>[];
  placeholder?: string;
  deleteValue?: T | null;
};

type SelectCellProps<T extends string = string> = {
  options: SelectOption<T>[];
  placeholder: string;
};

const SelectCell: CellComponent<string | null, SelectCellProps> = ({
  rowData,
  rowIndex,
  columnIndex,
  setRowData,
  active,
  focus,
  columnData,
}) => {
  const { options, placeholder } = columnData;
  const { setActiveCell } = useSpreadsheetContext();

  const selectorOptions = useMemo(
    () => options.map((opt) => ({ value: opt.value, label: opt.label })),
    [options],
  );

  const handleFocus = useCallback(() => {
    if (!active) {
      setActiveCell({ col: columnIndex, row: rowIndex });
    }
  }, [active, setActiveCell, columnIndex, rowIndex]);

  return (
    <div className="w-full h-full [&>div]:w-full [&>div]:h-full [&_button]:w-full [&_button]:h-full">
      <Selector
        options={selectorOptions}
        selected={rowData}
        onChange={(newValue) => setRowData(newValue)}
        nullable={true}
        placeholder={placeholder}
        styleOptions={{
          border: false,
          textSize: "text-sm",
          paddingX: 2,
          paddingY: 0,
          disableHoverEffects: true,
        }}
        disableFocusOnClose={true}
        tabIndex={focus ? 0 : -1}
        onDropdownInteraction={handleFocus}
      />
    </div>
  );
};

export const createSelectColumn = <T extends string = string>(
  options: SelectColumnOptions<T>,
): Partial<Column<T | null, SelectCellProps<T>>> => ({
  component: SelectCell as CellComponent<T | null, SelectCellProps<T>>,
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
