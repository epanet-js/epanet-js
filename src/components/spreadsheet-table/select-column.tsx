import { CellComponent, Column } from "react-datasheet-grid";
import { Selector } from "src/components/form/selector";
import { useMemo } from "react";

type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type SelectColumnOptions<T extends string = string> = {
  options: SelectOption<T>[];
  placeholder?: string;
};

type SelectCellProps<T extends string = string> = {
  options: SelectOption<T>[];
  placeholder: string;
};

const SelectCell: CellComponent<string | null, SelectCellProps> = ({
  rowData,
  setRowData,
  focus,
  columnData,
}) => {
  const { options, placeholder } = columnData;

  const selectorOptions = useMemo(
    () => options.map((opt) => ({ value: opt.value, label: opt.label })),
    [options],
  );

  return (
    <Selector
      options={selectorOptions}
      selected={rowData}
      onChange={(newValue) => setRowData(newValue)}
      nullable={true}
      placeholder={placeholder}
      styleOptions={{
        border: false,
        textSize: "text-xs",
        paddingX: 1,
        paddingY: 1,
      }}
      disableFocusOnClose={true}
      tabIndex={focus ? 0 : -1}
    />
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
  deleteValue: () => null,
  disableKeys: true,
});
