import { SpreadsheetCellProps, SpreadsheetColumn } from "../types";

type TextReadonlyCellExtraProps = {
  className?: string;
};

export function TextReadonlyCell({
  value,
  className,
}: SpreadsheetCellProps<string> & TextReadonlyCellExtraProps) {
  return (
    <div
      className={`w-full h-full flex items-center px-2 text-sm tabular-nums ${className ?? ""}`}
    >
      {value}
    </div>
  );
}

/**
 * Creates a text readonly column.
 *
 * @example
 * textReadonlyColumn("id", { header: "ID", className: "text-gray-500" })
 */
export function textReadonlyColumn(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    className?: string;
  },
): SpreadsheetColumn {
  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: (props: SpreadsheetCellProps<string>) => (
      <TextReadonlyCell {...props} className={options.className} />
    ),
    copyValue: (v) => v as string,
    pasteValue: (v) => v,
    deleteValue: "",
    disabled: true,
    disableKeys: true,
  };
}
