import { CellComponent, Column } from "react-datasheet-grid";

type TextReadonlyCellProps = {
  className?: string;
};

const TextReadonlyCell: CellComponent<string, TextReadonlyCellProps> = ({
  rowData,
  columnData,
}) => (
  <div
    className={`w-full h-full flex items-center px-2 text-sm tabular-nums ${columnData?.className ?? ""}`}
  >
    {rowData}
  </div>
);

export const createTextReadonlyColumn = (options?: {
  className?: string;
}): Partial<Column<string, TextReadonlyCellProps>> => ({
  component: TextReadonlyCell,
  columnData: { className: options?.className },
  disabled: true,
  disableKeys: true,
  copyValue: ({ rowData }) => rowData,
  pasteValue: ({ rowData }) => rowData,
  deleteValue: ({ rowData }) => rowData,
});
