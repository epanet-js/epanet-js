import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { triggerStylesFor, useUIConfig } from "@epanet-js/ui-kit";
import { InlineField } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { CheckIcon, ChevronDownIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";

type VirtualizedSelectOption = { value: number; label: string };

const ROW_HEIGHT = 32;
const LIST_MAX_HEIGHT = 180;
const OVERSCAN = 8;
const NO_INDEX = -1;

const triggerStyles = triggerStylesFor({
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
});

export const VirtualizedSelectRow = <P extends string>({
  name,
  selected,
  options,
  placeholder,
  clearLabel,
  comparison,
  onChange,
  readOnly = false,
}: {
  name: P;
  selected: number | null;
  options: VirtualizedSelectOption[];
  placeholder: string;
  clearLabel?: string;
  comparison?: PropertyComparison;
  onChange?: (
    name: P,
    newValue: number | null,
    oldValue: number | null,
  ) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const label = translate(name);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selected) ?? null,
    [options, selected],
  );

  const baseDisplayValue = comparison?.hasChanged
    ? comparison.baseValue != null
      ? (options.find((option) => option.value === comparison.baseValue)
          ?.label ?? String(comparison.baseValue))
      : `(${translate("none").toLocaleLowerCase()})`
    : undefined;

  const handleCommit = (value: number | null) => {
    setIsOpen(false);
    if (value !== selected) onChange?.(name, value, selected);
  };

  return (
    <InlineField
      name={label}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      {readOnly ? (
        <TextField padding="md">{selectedOption?.label ?? ""}</TextField>
      ) : (
        <div className="w-full">
          <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                role="combobox"
                aria-label={label}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className={triggerStyles}
              >
                <div
                  className={clsx(
                    "text-nowrap overflow-hidden text-ellipsis w-full text-left",
                    !selectedOption && "italic text-subtle",
                  )}
                >
                  {selectedOption ? selectedOption.label : placeholder}
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
                collisionPadding={8}
                className="bg-popover min-w-(--radix-popover-trigger-width) max-h-(--radix-popover-content-available-height) border text-size-base rounded-md shadow-md z-50 mt-1 overflow-hidden flex flex-col"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <OptionList
                  label={label}
                  options={options}
                  selected={selected}
                  clearLabel={clearLabel}
                  onCommit={handleCommit}
                  onClose={() => setIsOpen(false)}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      )}
    </InlineField>
  );
};

const OptionList = ({
  label,
  options,
  selected,
  clearLabel,
  onCommit,
  onClose,
}: {
  label: string;
  options: VirtualizedSelectOption[];
  selected: number | null;
  clearLabel?: string;
  onCommit: (value: number | null) => void;
  onClose: () => void;
}) => {
  const ui = useUIConfig();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(() =>
    options.findIndex((option) => option.value === selected),
  );
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    if (!trimmedQuery) return options;
    const normalizedQuery = trimmedQuery.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery),
    );
  }, [options, trimmedQuery]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    initialOffset: () =>
      Math.max(
        0,
        activeIndex * ROW_HEIGHT - (LIST_MAX_HEIGHT - ROW_HEIGHT) / 2,
      ),
  });

  useLayoutEffect(function focusSearchOnOpen() {
    inputRef.current?.focus();
  }, []);

  const moveActive = (nextIndex: number) => {
    setActiveIndex(nextIndex);
    virtualizer.scrollToIndex(nextIndex, { align: "auto" });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filtered.length === 0) return;
      moveActive(Math.min(activeIndex + 1, filtered.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filtered.length === 0) return;
      moveActive(Math.max(activeIndex - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option =
        filtered[activeIndex] ??
        (filtered.length === 1 ? filtered[0] : undefined);
      if (option) onCommit(option.value);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="p-2 border-b">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(event.target.value.trim() ? 0 : NO_INDEX);
            virtualizer.scrollToOffset(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={ui.searchPlaceholder}
          className="w-full h-8 px-2 text-size-base border rounded-sm outline-hidden border-strong focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>
      <div
        ref={setScrollElement}
        className="overflow-y-auto min-h-0 p-1 [scrollbar-width:thin]"
        style={{ maxHeight: LIST_MAX_HEIGHT }}
      >
        {filtered.length === 0 ? (
          <div className="px-2 py-2 text-subtle">{ui.noResultsLabel}</div>
        ) : (
          <ul
            role="listbox"
            aria-label={label}
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const option = filtered[virtualRow.index];
              const isSelected = option.value === selected;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={clsx(
                    "absolute left-0 right-0 flex items-center justify-between gap-4 px-2 rounded-sm cursor-pointer text-default",
                    isSelected
                      ? "bg-accent-tint"
                      : virtualRow.index === activeIndex
                        ? "bg-base-hover"
                        : "hover:bg-base-hover",
                  )}
                  style={{
                    height: ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onCommit(option.value)}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <CheckIcon className="text-accent shrink-0" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {clearLabel !== undefined && (
        <div className="p-1 border-t">
          <button
            type="button"
            className="flex items-center w-full h-8 px-2 italic cursor-pointer text-default rounded-sm hover:bg-base-hover"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onCommit(null)}
          >
            {clearLabel}
          </button>
        </div>
      )}
    </div>
  );
};
