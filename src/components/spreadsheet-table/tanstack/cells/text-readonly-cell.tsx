import { SpreadsheetCellProps, SpreadsheetColumnDef } from "../types";

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
 * Creates a text readonly column definition.
 * Use with keyColumn: keyColumn("fieldName", createTextReadonlyColumn({ className: "..." }))
 */
export function createTextReadonlyColumn<
  TData extends Record<string, unknown>,
>(options?: {
  className?: string;
}): Partial<SpreadsheetColumnDef<TData, string>> {
  return {
    meta: {
      cellComponent: (props: SpreadsheetCellProps<string>) => (
        <TextReadonlyCell {...props} className={options?.className} />
      ),
      copyValue: (v) => v,
      pasteValue: (v) => v,
      deleteValue: "",
      disabled: true,
      disableKeys: true,
    },
  };
}
