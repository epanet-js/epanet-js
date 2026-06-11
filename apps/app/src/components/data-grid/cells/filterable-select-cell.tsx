import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { ChevronDownIcon } from "src/icons";
import type { Row, RowData } from "@tanstack/react-table";
import {
  SelectorList,
  SelectorListOption,
} from "src/components/form/selector-list";
import { CellProps, GridColumn } from "../types";
import { type ColumnKey, resolveColumnKey } from "./column-key";

export type FilterableSelectOption<
  T extends string | number | boolean = string,
> = {
  value: T;
  label: string;
  enabled?: boolean;
};

type FilterableSelectCellProps<
  T extends string | number | boolean = string | number | boolean,
> = {
  options: FilterableSelectOption<T>[];
  placeholder: string;
  emptyOptionLabel?: string;
  minOptionsForSearch?: number;
  actionLabel?: string;
  onActionClick?: () => void;
  allowNew?: boolean;
  createLabel?: (query: string) => string;
  validateNew?: (query: string) => boolean;
};

export function FilterableSelectCell({
  value,
  onChange,
  stopEditing,
  startEditing,
  isActive,
  editMode,
  readOnly,
  options,
  placeholder,
  emptyOptionLabel,
  minOptionsForSearch,
  actionLabel,
  onActionClick,
  allowNew,
  createLabel,
  validateNew,
}: CellProps<string | number | boolean | null> &
  FilterableSelectCellProps<string | number | boolean>) {
  const isOpen = !!editMode;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [initialQuery, setInitialQuery] = useState("");

  const listOptions: SelectorListOption<string | number | boolean>[] = useMemo(
    () =>
      options.map((o) => ({
        value: o.value,
        label: o.label,
        disabled: o.enabled === false,
      })),
    [options],
  );

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  useEffect(
    function syncCellIsActive() {
      if (isActive) {
        buttonRef.current?.focus();
      }
    },
    [isActive],
  );

  useEffect(
    function clearInitialQueryOnClose() {
      if (!isOpen) setInitialQuery("");
    },
    [isOpen],
  );

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const EXCLUDED_KEYS = [
        "ArrowUp",
        "ArrowLeft",
        "ArrowDown",
        "Esc",
        "Delete",
        "Backspace",
        "Tab",
      ];
      if (EXCLUDED_KEYS.includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        setInitialQuery(e.key);
        startEditing();
      }
    },
    [startEditing],
  );

  if (readOnly) {
    return (
      <div className="w-full h-full pl-2 flex items-center justify-between gap-1 text-size-base bg-panel">
        <span
          className={clsx(
            "truncate",
            !selectedOption ? "text-subtle" : "text-default",
          )}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <div className="pl-1 text-subtle">
          <ChevronDownIcon />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <Popover.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (open) startEditing();
          else stopEditing();
        }}
      >
        <Popover.Trigger asChild>
          <button
            ref={buttonRef}
            type="button"
            tabIndex={-1}
            onKeyDown={handleTriggerKeyDown}
            className="w-full h-full pl-2 flex items-center justify-between gap-1 text-size-base text-default bg-transparent border-none outline-hidden text-left min-w-0"
          >
            <span
              className={clsx("truncate", !selectedOption && "text-subtle")}
            >
              {selectedOption?.label ?? placeholder}
            </span>
            <div className="pl-1">
              <ChevronDownIcon />
            </div>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            className="bg-popover min-w-[180px] border text-size-base rounded-md shadow-md z-50 mt-1"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => {
              if (buttonRef.current?.contains(e.target as Node)) {
                e.preventDefault();
              }
            }}
          >
            {isOpen && (
              <SelectorList<string | number | boolean>
                options={listOptions}
                selected={value}
                nullable
                onCommit={(v) => {
                  onChange(v);
                  stopEditing();
                }}
                onClose={stopEditing}
                clearLabel={emptyOptionLabel}
                actionLabel={actionLabel}
                onActionClick={onActionClick}
                allowNew={allowNew}
                createLabel={createLabel}
                minOptionsForSearch={minOptionsForSearch}
                validateNew={validateNew}
                initialQuery={initialQuery}
              />
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export function filterableSelectColumn<
  T extends string | number | boolean = string,
  TData extends RowData = RowData,
>(
  key: ColumnKey<TData, T | null>,
  options: {
    header: string;
    size?: number;
    options: FilterableSelectOption<T>[];
    placeholder?: string;
    emptyOptionLabel?: string;
    emptyValue?: T | null;
    minOptionsForSearch?: number;
    isReadOnly?: boolean | ((rowIndex: number) => boolean);
    actionLabel?: string;
    onActionClick?: () => void;
    allowNew?: boolean;
    createLabel?: (query: string) => string;
    validateNew?: (query: string) => boolean;
  },
): GridColumn<TData> {
  const isEmpty = options.options.length === 0 && !options.allowNew;
  const resolveReadOnly = (rowIndex: number) =>
    typeof options.isReadOnly === "function"
      ? options.isReadOnly(rowIndex)
      : (options.isReadOnly ?? false);

  const column = {
    ...resolveColumnKey(key),
    header: options.header,
    size: options.size,
    sortingFn: (rowA: Row<TData>, rowB: Row<TData>, columnId: string) => {
      const aVal = rowA.getValue(columnId);
      const bVal = rowB.getValue(columnId);
      const aLabel =
        options.options.find((o) => o.value === aVal)?.label ??
        String(aVal ?? "");
      const bLabel =
        options.options.find((o) => o.value === bVal)?.label ??
        String(bVal ?? "");
      return aLabel.localeCompare(bLabel);
    },
    meta: {
      autoSizeExtraWidth: 32,
      placeholder: options.placeholder,
      copyValue: (v: T | null) => {
        const match = options.options.find((opt) => opt.value === v);
        return match?.label ?? "";
      },
      pasteValue: (v: string) => {
        const match = options.options.find(
          (opt) =>
            opt.enabled !== false &&
            (String(opt.value) === v ||
              opt.label.toLowerCase() === v.toLowerCase()),
        );
        if (match) return match.value;
        if (v === "") return options.emptyValue;
        return undefined;
      },
      deleteValue: options.emptyValue,
      isReadOnly: isEmpty ? true : options.isReadOnly,
      cellComponent: (props: CellProps<T | null>) => (
        <FilterableSelectCell
          {...(props as CellProps<string | number | boolean | null>)}
          readOnly={
            isEmpty || props.readOnly || resolveReadOnly(props.rowIndex)
          }
          options={
            options.options as FilterableSelectOption<
              string | number | boolean
            >[]
          }
          placeholder={options.placeholder ?? ""}
          emptyOptionLabel={options.emptyOptionLabel}
          minOptionsForSearch={options.minOptionsForSearch}
          actionLabel={options.actionLabel}
          onActionClick={options.onActionClick}
          allowNew={options.allowNew}
          createLabel={options.createLabel}
          validateNew={options.validateNew}
        />
      ),
    },
  };
  return column as GridColumn<TData>;
}
