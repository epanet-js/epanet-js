import { localizeDecimal } from "src/infra/i18n/numbers";
import { NumericField } from "./numeric-field";

export type Cell = {
  label: string;
  value: number | null;
  handler?: (newValue: number, isEmpty: boolean) => void;
  positiveOnly?: boolean;
  isNullable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  decimals?: number;
  hasError?: boolean;
};

type NumericTableProps = {
  labels: { horizontal: [string, string]; vertical: string[] };
  cells: Array<[Cell, Cell]>;
};

export const NumericTable = ({ labels, cells }: NumericTableProps) => {
  return (
    <div
      role="table"
      className="w-full grid grid-cols-[auto_1fr_1fr] items-center"
    >
      <GridHeader labels={labels.horizontal} />
      {cells.map((row, rowIndex) => {
        return (
          <GridRow
            key={labels.vertical[rowIndex]}
            label={labels.vertical[rowIndex]}
            cells={row}
          />
        );
      })}
    </div>
  );
};

const GridHeader = ({ labels }: { labels: [string, string] }) => {
  return (
    <>
      <div role="columnheader"></div>

      {labels.map((label, colIndex) => (
        <div
          role="columnheader"
          key={colIndex}
          className="pl-2 py-1 text-sm font-semibold text-gray-500 truncate"
        >
          <span>{label}</span>
        </div>
      ))}
    </>
  );
};

const GridRow = ({ label, cells }: { label: string; cells: [Cell, Cell] }) => {
  return (
    <>
      <div role="cell" className="pt-2 text-sm text-gray-500">
        {label}
      </div>

      {cells.map((cell, colIndex) => {
        const displayValue =
          cell.value !== null
            ? localizeDecimal(cell.value, {
                decimals: cell.decimals,
              })
            : "";
        return (
          <div role="cell" className="pl-2 pt-2" key={colIndex}>
            {!cell.readOnly ? (
              <NumericField
                label={cell.label}
                positiveOnly={cell.positiveOnly}
                isNullable={cell.isNullable}
                displayValue={displayValue}
                onChangeValue={cell.handler}
                styleOptions={{
                  padding: "sm",
                  textSize: "sm",
                  variant: cell.hasError ? "warning" : "default",
                }}
              />
            ) : (
              <span className="block p-1 text-sm text-gray-700 dark:text-gray-100 tabular-nums border border-transparent">
                {displayValue}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
};
