import { SpreadsheetCellProps, SpreadsheetColumn } from "../types";

type TextReadonlyCellProps = SpreadsheetCellProps<string> & {
  className?: string;
};

export function TextReadonlyCell({
  value,
  isSelected,
  className,
}: TextReadonlyCellProps) {
  return (
    <div
      className={`w-full h-full flex items-center px-2 text-sm tabular-nums text-gray-500 ${isSelected ? "" : "bg-gray-50"} ${className ?? ""}`}
    >
      {value}
    </div>
  );
}

export function textReadonlyColumn(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    className?: string;
  },
): SpreadsheetColumn {
  const { className } = options;

  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: className
      ? (props: SpreadsheetCellProps<string>) => (
          <TextReadonlyCell {...props} className={className} />
        )
      : TextReadonlyCell,
    copyValue: (v) => v as string,
    pasteValue: (v) => v,
    deleteValue: "",
    disabled: true,
    disableKeys: true,
  };
}
