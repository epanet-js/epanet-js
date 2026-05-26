import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { CheckIcon, ChevronDownIcon } from "src/icons";
import { StyleOptions, triggerStylesFor } from "./selector-trigger";

export type EnhancedSelectorOption<T extends string | number> = {
  label: string;
  description?: string;
  value: T;
  disabled?: boolean;
};

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

const NO_INDEX = -1;

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
  searchPlaceholder = "Search…",
  allowNew = false,
  createLabel = (query) => `Add "${query}"`,
  minOptionsForSearch = 8,
  nullable = false,
  placeholder,
  clearLabel,
  actionLabel,
  onActionClick,
  listClassName,
}: EnhancedSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(NO_INDEX);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const showSearch = allowNew || options.length >= minOptionsForSearch;
  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    if (!trimmedQuery) return options;
    const q = trimmedQuery.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, trimmedQuery]);

  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false;
    const q = trimmedQuery.toLowerCase();
    return options.some((o) => o.label.toLowerCase() === q);
  }, [options, trimmedQuery]);

  const showCreateOption =
    allowNew && trimmedQuery.length > 0 && !hasExactMatch;
  const totalEntries = filtered.length + (showCreateOption ? 1 : 0);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === selected) ?? null,
    [options, selected],
  );

  useEffect(
    function resetOnOpen() {
      if (!open) return;
      setQuery("");
      const idx =
        selected === null
          ? NO_INDEX
          : options.findIndex((o) => o.value === selected);
      setActiveIndex(idx);
      requestAnimationFrame(() => {
        if (showSearch) {
          inputRef.current?.focus();
        } else {
          listContainerRef.current?.focus();
        }
      });
    },
    [open, options, selected, showSearch],
  );

  const commit = useCallback(
    (value: T | null) => {
      if (value !== selected) {
        (onChange as (v: T | null, old: T | null) => void)(value, selected);
      }
      setOpen(false);
    },
    [onChange, selected],
  );

  const commitActive = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < filtered.length) {
      const opt = filtered[activeIndex];
      if (opt.disabled) return;
      commit(opt.value);
      return;
    }
    if (showCreateOption) {
      commit(trimmedQuery as T);
      return;
    }
    if (!trimmedQuery && filtered.length > 0 && !filtered[0].disabled) {
      commit(filtered[0].value);
    }
  }, [activeIndex, filtered, showCreateOption, trimmedQuery, commit]);

  const findNextEnabled = useCallback(
    (start: number, direction: 1 | -1): number => {
      if (totalEntries === 0) return NO_INDEX;
      let i = start;
      for (let steps = 0; steps < totalEntries; steps++) {
        if (i < 0) i = totalEntries - 1;
        if (i >= totalEntries) i = 0;
        const isCreateRow = showCreateOption && i === filtered.length;
        if (isCreateRow || !filtered[i]?.disabled) return i;
        i += direction;
      }
      return NO_INDEX;
    },
    [filtered, showCreateOption, totalEntries],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          findNextEnabled(
            prev < 0 ? 0 : Math.min(prev + 1, totalEntries - 1),
            1,
          ),
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          findNextEnabled(prev <= 0 ? totalEntries - 1 : prev - 1, -1),
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commitActive();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    },
    [totalEntries, commitActive, findNextEnabled],
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

  const effectiveClearLabel = clearLabel ?? placeholder;
  const showClearRow = nullable && selected !== null;
  const showActionRow =
    actionLabel !== undefined && onActionClick !== undefined;
  const showList = filtered.length > 0 || showCreateOption;

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
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (buttonRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div
            ref={listContainerRef}
            tabIndex={showSearch ? -1 : 0}
            onKeyDown={handleKeyDown}
            onMouseLeave={() => setActiveIndex(NO_INDEX)}
            className="outline-hidden"
          >
            {showSearch && (
              <div
                className={clsx(
                  "p-2",
                  (showList || showClearRow || showActionRow) &&
                    "border-b border-gray-200",
                )}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(e.target.value.trim() ? 0 : NO_INDEX);
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-sm outline-hidden focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
            )}
            {showList && (
              <div className="outline-hidden max-h-56 overflow-auto scroll-shadows [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <ul role="listbox" tabIndex={-1} className="p-1">
                  {filtered.map((option, i) => {
                    const isOptionDisabled = !!option.disabled;
                    return (
                      <li
                        key={String(option.value)}
                        role="option"
                        aria-selected={option.value === selected}
                        aria-disabled={isOptionDisabled}
                        className={clsx(
                          "flex items-center justify-between gap-4 px-2 py-2 rounded-sm",
                          isOptionDisabled
                            ? "cursor-default text-gray-400"
                            : "cursor-pointer text-gray-700",
                          !isOptionDisabled &&
                            i === activeIndex &&
                            "bg-purple-300/40",
                          !isOptionDisabled &&
                            i !== activeIndex &&
                            "hover:bg-gray-100",
                          listClassName,
                        )}
                        onMouseEnter={
                          isOptionDisabled ? undefined : () => setActiveIndex(i)
                        }
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={
                          isOptionDisabled
                            ? undefined
                            : () => commit(option.value)
                        }
                      >
                        <span>{option.description ?? option.label}</span>
                        {option.value === selected && (
                          <CheckIcon className="text-purple-700 shrink-0" />
                        )}
                      </li>
                    );
                  })}
                  {showCreateOption && (
                    <li
                      role="option"
                      className={clsx(
                        "flex items-center px-2 py-2 cursor-pointer text-purple-700 rounded-sm",
                        filtered.length > 0 &&
                          "border-t border-gray-100 mt-1 pt-2",
                        activeIndex === filtered.length && "bg-purple-300/40",
                        activeIndex !== filtered.length && "hover:bg-gray-100",
                      )}
                      onMouseEnter={() => setActiveIndex(filtered.length)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commit(trimmedQuery as T)}
                    >
                      {createLabel(trimmedQuery)}
                    </li>
                  )}
                </ul>
              </div>
            )}
            {showClearRow && (
              <div
                className={clsx(
                  "p-1",
                  (showSearch || showList) && "border-t border-gray-100",
                )}
              >
                <button
                  type="button"
                  className="flex items-center justify-between gap-4 w-full px-2 py-2 italic cursor-pointer text-gray-700 hover:bg-purple-300/40 rounded-sm"
                  onMouseEnter={() => setActiveIndex(NO_INDEX)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(null)}
                >
                  {effectiveClearLabel}
                </button>
              </div>
            )}
            {showActionRow && (
              <div
                className={clsx(
                  "p-1",
                  (showSearch || showList || showClearRow) &&
                    "border-t border-gray-100",
                )}
              >
                <button
                  type="button"
                  className="flex items-center justify-between gap-4 w-full px-2 py-2 italic cursor-pointer text-gray-700 hover:bg-purple-300/40 rounded-sm"
                  onMouseEnter={() => setActiveIndex(NO_INDEX)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onActionClick();
                    setOpen(false);
                  }}
                >
                  {actionLabel}
                </button>
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
