import { useCallback, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { ChevronDownIcon } from "src/icons";
import { useDialogContentContainer } from "src/components/dialog";
import { StyleOptions, triggerStylesFor } from "./selector-trigger";
import { BaseSelectorList, SelectorListOption } from "./selector-list";

export type SelectorOption<T extends string | number> = SelectorListOption<T>;

type SelectorPropsBase<T extends string | number> = {
  options: SelectorOption<T>[];
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
  validateNew?: (query: string) => boolean;
};

type SelectorPropsNonNullable<T extends string | number> =
  SelectorPropsBase<T> & {
    selected: T;
    onChange: (selected: T, oldValue: T) => void;
    nullable?: false;
    placeholder?: never;
    clearLabel?: never;
  };

type SelectorPropsNullable<T extends string | number> = SelectorPropsBase<T> & {
  selected: T | null;
  onChange: (selected: T | null, oldValue: T | null) => void;
  nullable: true;
  placeholder: string;
  clearLabel?: string;
};

type SelectorProps<T extends string | number> =
  | SelectorPropsNonNullable<T>
  | SelectorPropsNullable<T>;

export const Selector = BaseSelector;

export function BaseSelector<T extends string | number>(
  props: SelectorPropsNonNullable<T>,
): JSX.Element;
export function BaseSelector<T extends string | number>(
  props: SelectorPropsNullable<T>,
): JSX.Element;
export function BaseSelector<T extends string | number>({
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
  validateNew,
}: SelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogContainer = useDialogContentContainer();

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
              selectedOption === null && nullable && "italic text-subtle",
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
      <Popover.Portal container={dialogContainer ?? undefined}>
        <Popover.Content
          side="bottom"
          align="start"
          className="bg-popover min-w-(--radix-popover-trigger-width) border text-size-base rounded-md shadow-md z-50 mt-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (buttonRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
        >
          {open && (
            <BaseSelectorList<T>
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
              validateNew={validateNew}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
