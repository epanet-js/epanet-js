import React, { useCallback, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { ChevronDownIcon } from "../icons";
import { useSelectorPortalContainer } from "../portal";
import { StyleOptions, triggerStylesFor } from "./selector-trigger";
import {
  BaseSelectorList,
  SelectorListOption,
  isSelectorEmpty,
} from "./selector-list";

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
  onActiveOptionChange?: (value: T | null) => void;
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
  onActiveOptionChange,
}: SelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalContainer = useSelectorPortalContainer();

  const selectedOption = useMemo(
    () => options.find((o) => o.value === selected) ?? null,
    [options, selected],
  );

  // An empty selector (no options and no way to add content) has nothing to
  // show, so we treat it as disabled rather than opening an empty dropdown.
  const effectiveDisabled =
    disabled || isSelectorEmpty(options, { allowNew, onActionClick });

  const triggerStyles = useMemo(
    () => triggerStylesFor(styleOptions, { disabled: effectiveDisabled }),
    [styleOptions, effectiveDisabled],
  );

  const handleTriggerClick = useCallback(() => {
    if (effectiveDisabled) return;
    setOpen((prev) => !prev);
  }, [effectiveDisabled]);

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (effectiveDisabled) return;
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
    [effectiveDisabled],
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
    <Popover.Root
      open={open}
      onOpenChange={effectiveDisabled ? undefined : setOpen}
    >
      <Popover.Trigger asChild>
        <button
          ref={buttonRef}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          tabIndex={tabIndex}
          disabled={effectiveDisabled}
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
      <Popover.Portal container={portalContainer ?? undefined}>
        <Popover.Content
          side="bottom"
          align="start"
          collisionPadding={8}
          className="bg-popover min-w-(--radix-popover-trigger-width) max-h-(--radix-popover-content-available-height) border text-size-base rounded-md shadow-md z-50 mt-1 overflow-hidden flex flex-col"
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
              onActiveOptionChange={onActiveOptionChange}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
