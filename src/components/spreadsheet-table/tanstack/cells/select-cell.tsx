import { useCallback, useMemo } from "react";
import { Selector } from "src/components/form/selector";
import { SpreadsheetCellProps, SpreadsheetColumnDef } from "../types";

type SelectOption<T extends string = string> = {
  value: T;
  label: string;
};

type SelectCellExtraProps<T extends string = string> = {
  options: SelectOption<T>[];
  placeholder: string;
};

export function SelectCell<T extends string = string>({
  value,
  onChange,
  focus,
  options,
  placeholder,
}: SpreadsheetCellProps<T | null> & SelectCellExtraProps<T>) {
  const selectorOptions = useMemo(
    () => options.map((opt) => ({ value: opt.value, label: opt.label })),
    [options],
  );

  const handleChange = useCallback(
    (newValue: T | null) => {
      onChange(newValue);
    },
    [onChange],
  );

  return (
    <div className="w-full h-full [&>div]:w-full [&>div]:h-full [&_button]:w-full [&_button]:h-full [&_button]:pr-0">
      <Selector
        options={selectorOptions}
        selected={value}
        onChange={handleChange}
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
      />
    </div>
  );
}

/**
 * Creates a select (dropdown) column definition.
 * Use with keyColumn: keyColumn("fieldName", createSelectColumn({ options: [...] }))
 */
export function createSelectColumn<
  TData extends Record<string, unknown>,
  T extends string = string,
>(options: {
  options: SelectOption<T>[];
  placeholder?: string;
  deleteValue?: T | null;
}): Partial<SpreadsheetColumnDef<TData, T | null>> {
  return {
    meta: {
      cellComponent: (props: SpreadsheetCellProps<T | null>) => (
        <SelectCell
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
