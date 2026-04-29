import clsx from "clsx";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  normalizeNumericInput,
  parseNumericInput,
} from "src/components/form/numeric-input-utils";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { CellProps, EditMode, GridColumn } from "../types";

function formatLocaleNumber(
  value: number | null | undefined,
  decimals = 9,
): string {
  if (value === null || value === undefined) return "";
  return localizeDecimal(value, { decimals });
}

type FloatCellProps = CellProps<number | null> & {
  nullValue?: number | null;
  decimals?: number;
  readonly?: boolean;
};

export function FloatCell({
  value,
  editMode,
  onChange,
  stopEditing,
  nullValue = null,
  decimals,
  readonly,
}: FloatCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState("");
  const [hasError, setHasError] = useState(false);
  const shouldCommitOnBlurRef = useRef(false);
  const [prevEditMode, setPrevEditMode] = useState<EditMode>(false);

  if (editMode && editMode !== prevEditMode) {
    setPrevEditMode(editMode);
    setEditValue(formatLocaleNumber(value));
    setHasError(false);
    shouldCommitOnBlurRef.current = true;
  }
  if (!editMode && prevEditMode) {
    setPrevEditMode(false);
    setHasError(false);
  }

  useLayoutEffect(() => {
    if (editMode) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editMode]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const newValue = normalizeNumericInput(rawValue, {
        allowExponentSign: true,
      });
      if (newValue === editValue) return;
      if (rawValue.length > 0 && newValue.length === 0) return;
      setEditValue(newValue);
      setHasError(
        newValue.trim() !== "" && parseNumericInput(newValue) === null,
      );
    },
    [editValue],
  );

  const commit = useCallback(() => {
    const parsed = parseNumericInput(editValue);
    if (parsed !== null) {
      onChange(parsed);
    } else if (editValue.trim() === "") {
      onChange(nullValue);
    }
  }, [editValue, onChange, nullValue]);

  const handleBlur = useCallback(() => {
    if (!shouldCommitOnBlurRef.current) return;
    shouldCommitOnBlurRef.current = false;
    commit();
  }, [commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        shouldCommitOnBlurRef.current = false;
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        shouldCommitOnBlurRef.current = false;
        stopEditing();
      } else if (
        editMode === "quick" &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(
          e.key,
        )
      ) {
        commit();
      }
    },
    [editMode, commit, stopEditing],
  );

  const formattedValue = formatLocaleNumber(value, decimals);

  if (readonly) {
    return (
      <div className="w-full h-full flex items-center px-2 text-sm tabular-nums text-gray-500">
        {formattedValue}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "w-full h-full flex items-center",
        hasError &&
          editMode &&
          "z-[2] bg-orange-100 dark:bg-orange-900/30 ring-1 ring-orange-500 dark:ring-orange-700",
      )}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={editMode ? editValue : formattedValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={!editMode}
        className="w-full px-2 text-sm tabular-nums outline-none border-none ring-0 focus:outline-none focus:ring-0 bg-transparent truncate"
      />
    </div>
  );
}

export function floatColumn(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    deleteValue?: number | null;
    nullValue?: number | null;
    decimals?: number;
    readonly?: boolean;
  },
): GridColumn {
  const { nullValue, decimals, readonly } = options;

  const CellComponent =
    nullValue !== undefined || decimals !== undefined || readonly
      ? (props: CellProps<number | null>) => (
          <FloatCell
            {...props}
            nullValue={nullValue}
            decimals={decimals}
            readonly={readonly}
          />
        )
      : FloatCell;

  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: CellComponent,
    copyValue: (v) => {
      const num = v as number | null;
      return formatLocaleNumber(num, decimals);
    },
    pasteValue: (v) => parseNumericInput(v) ?? nullValue ?? null,
    deleteValue: options.deleteValue ?? null,
    ...(readonly ? { disabled: true, disableKeys: true } : {}),
  };
}
