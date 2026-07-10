import React, { useCallback, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { ChevronDownIcon } from "../icons";
import { useSelectorPortalContainer } from "../portal";
import { StyleOptions, triggerStylesFor } from "./selector-trigger";
import { SelectorListOption, isSelectorEmpty } from "./selector-list";
import { BaseMultiSelectorList } from "./multi-selector-list";

export type MultiSelectorOption<T extends string | number> =
  SelectorListOption<T>;

export type MultiSelectorProps<T extends string | number> = {
  options: MultiSelectorOption<T>[];
  selected: T[];
  onChange?: (next: T[]) => void;
  onOptionSelected?: (value: T) => void;
  onOptionRemoved?: (value: T) => void;
  /** Resolved trigger text when selected.length > 0, e.g. "3 selected". The
   *  consuming app composes/pluralizes/translates it (ui-kit is string-pure). */
  valueLabel: string;
  /** Resolved empty-state text shown when selected.length === 0. */
  placeholder: string;
  ariaLabel?: string;
  tabIndex?: number;
  styleOptions?: StyleOptions;
  disabled?: boolean;
  searchPlaceholder?: string;
  minOptionsForSearch?: number;
  listClassName?: string;
  maxVisibleOptions?: number;
  /** Where the dropdown opens: "auto" (default) lets it flip to fit the
   *  viewport; "top"/"bottom" pin it to that side and never flip. */
  side?: "top" | "bottom" | "auto";
};

export const MultiSelector = BaseMultiSelector;

export function BaseMultiSelector<T extends string | number>({
  options,
  selected,
  onChange,
  onOptionSelected,
  onOptionRemoved,
  valueLabel,
  placeholder,
  ariaLabel,
  tabIndex = 1,
  styleOptions = {},
  disabled = false,
  searchPlaceholder,
  minOptionsForSearch,
  listClassName,
  maxVisibleOptions,
  side = "auto",
}: MultiSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalContainer = useSelectorPortalContainer();

  const effectiveDisabled = disabled || isSelectorEmpty(options);

  const triggerStyles = triggerStylesFor(styleOptions, {
    disabled: effectiveDisabled,
  });

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

  const handleToggle = useCallback(
    (value: T) => {
      if (selected.includes(value)) {
        onChange?.(selected.filter((v) => v !== value));
        onOptionRemoved?.(value);
      } else {
        onChange?.([...selected, value]);
        onOptionSelected?.(value);
      }
    },
    [selected, onChange, onOptionSelected, onOptionRemoved],
  );

  const isEmpty = selected.length === 0;

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
              isEmpty && "italic text-subtle",
            )}
          >
            {isEmpty ? placeholder : valueLabel}
          </div>
          <div className="px-1">
            <ChevronDownIcon />
          </div>
        </button>
      </Popover.Trigger>
      <Popover.Portal container={portalContainer ?? undefined}>
        <Popover.Content
          side={side === "auto" ? "bottom" : side}
          avoidCollisions={side === "auto"}
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
            <BaseMultiSelectorList<T>
              options={options}
              selected={selected}
              onToggle={handleToggle}
              onClose={() => setOpen(false)}
              minOptionsForSearch={minOptionsForSearch}
              searchPlaceholder={searchPlaceholder}
              listClassName={listClassName}
              maxVisibleOptions={maxVisibleOptions}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
