import { useCallback, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { ChevronDownIcon } from "src/icons";
import { StyleOptions, triggerStylesFor } from "./selector-trigger";
import { SelectorList, SelectorListOption } from "./selector-list";

export type EnhancedSelectorOption<T extends string | number> =
  SelectorListOption<T>;

type EnhancedSelectorPropsBase<T extends string | number> = {
  options: EnhancedSelectorOption<T>[];
  ariaLabel?: string;
  tabIndex?: number;
  styleOptions?: StyleOptions;
  disabled?: boolean;
  searchPlaceholder?: string;
  allowNew?: boolean;
  createLabel?: (query: string) => string;
  minOptionsForSearch?: number;
  actionLabel?: string;
  onActionClick?: () => void;
  listClassName?: string;
};

type EnhancedSelectorPropsNonNullable<T extends string | number> =
  EnhancedSelectorPropsBase<T> & {
    selected: T;
    onChange: (selected: T, oldValue: T) => void;
    nullable?: false;
    placeholder?: never;
    clearLabel?: never;
  };

type EnhancedSelectorPropsNullable<T extends string | number> =
  EnhancedSelectorPropsBase<T> & {
    selected: T | null;
    onChange: (selected: T | null, oldValue: T | null) => void;
    nullable: true;
    placeholder: string;
    clearLabel?: string;
  };

type EnhancedSelectorProps<T extends string | number> =
  | EnhancedSelectorPropsNonNullable<T>
  | EnhancedSelectorPropsNullable<T>;

export function EnhancedSelector<T extends string | number>(
  props: EnhancedSelectorPropsNonNullable<T>,
): JSX.Element;
export function EnhancedSelector<T extends string | number>(
  props: EnhancedSelectorPropsNullable<T>,
): JSX.Element;
export function EnhancedSelector<T extends string | number>({
  options,
  selected,
  onChange,
  ariaLabel,
  tabIndex = 1,
  styleOptions = {},
  disabled = false,
  searchPlaceholder,
  allowNew,
  createLabel,
  minOptionsForSearch,
  nullable = false,
  placeholder,
  clearLabel,
  actionLabel,
  onActionClick,
  listClassName,
}: EnhancedSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === selected) ?? null,
    [options, selected],
  );

  const triggerStyles = useMemo(
    () => triggerStylesFor(styleOptions, { disabled }),
    [styleOptions, disabled],
  );

  const handleTriggerClick = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => !prev);
  }, [disabled]);

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (
        e.key === "Enter" ||
        e.key === " " ||
        e.key === "ArrowDown" ||
        e.key === "ArrowUp"
      ) {
        e.preventDefault();
        setOpen(true);
      }
    },
    [disabled],
  );

  const handleCommit = useCallback(
    (value: T | null) => {
      const oldValue = selected;
      if (value !== oldValue) {
        (onChange as (v: T | null, old: T | null) => void)(value, oldValue);
      }
      setOpen(false);
    },
    [onChange, selected],
  );

  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={buttonRef}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          tabIndex={tabIndex}
          disabled={disabled}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
          className={triggerStyles}
        >
          <div
            className={clsx(
              "text-nowrap overflow-hidden text-ellipsis w-full text-left",
              selectedOption === null && nullable && "italic text-gray-500",
            )}
          >
            {selectedOption
              ? (selectedOption.description ?? selectedOption.label)
              : (placeholder ?? "")}
          </div>
          <div className="px-1">
            <ChevronDownIcon />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          className="bg-white min-w-(--radix-popover-trigger-width) border text-sm rounded-md shadow-md z-50 mt-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (buttonRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
        >
          {open && (
            <SelectorList<T>
              options={options}
              selected={selected ?? null}
              nullable={nullable}
              onCommit={handleCommit}
              onClose={() => setOpen(false)}
              actionLabel={actionLabel}
              onActionClick={onActionClick}
              clearLabel={clearLabel}
              allowNew={allowNew}
              createLabel={createLabel}
              minOptionsForSearch={minOptionsForSearch}
              searchPlaceholder={searchPlaceholder}
              listClassName={listClassName}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
