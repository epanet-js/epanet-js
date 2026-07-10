import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
} from "react";
import clsx from "clsx";
import { CheckIcon } from "../icons";
import { useUIConfig } from "../ui-config";
import { SelectorListOption } from "./selector-list";

// Multi-select sibling of `BaseSelectorList` (./selector-list.tsx). It shares the
// same look and keyboard/search behaviour but toggles membership without closing
// and never grows create/clear/action rows. When both lists stabilise, the shared
// navigation/search subset should be extracted into a hook consumed by both.
export type MultiSelectorListProps<T extends string | number> = {
  options: SelectorListOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  onClose: () => void;
  minOptionsForSearch?: number;
  searchPlaceholder?: string;
  listClassName?: string;
  maxVisibleOptions?: number;
};

const NO_INDEX = -1;
const PAGE_SIZE = 5;
const TYPE_AHEAD_RESET_MS = 500;

const ROW_REM = 2;
const LIST_TOP_PAD_REM = 0.25;

export const MultiSelectorList = BaseMultiSelectorList;

export function BaseMultiSelectorList<T extends string | number>({
  options,
  selected,
  onToggle,
  onClose,
  minOptionsForSearch = 8,
  searchPlaceholder,
  listClassName,
  maxVisibleOptions = 5,
}: MultiSelectorListProps<T>) {
  const ui = useUIConfig();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(NO_INDEX);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const showSearch = options.length >= minOptionsForSearch;
  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    if (!trimmedQuery) return options;
    const q = trimmedQuery.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, trimmedQuery]);

  const showList = filtered.length > 0;
  const totalEntries = filtered.length;

  // While searching, reserve the height of the original (unfiltered) list capped
  // at the visible max, so filtering never resizes the popover and Radix can't
  // flip it to the other side mid-search. Without a search box the list can't be
  // filtered, so it just sizes to content up to the cap.
  const capRem = (maxVisibleOptions + 0.5) * ROW_REM + LIST_TOP_PAD_REM;
  const fullRem = options.length * ROW_REM + LIST_TOP_PAD_REM;
  const listAreaStyle = showSearch
    ? { height: `min(${capRem}rem, ${fullRem}rem)` }
    : { maxHeight: `${capRem}rem` };

  useLayoutEffect(
    function focusOnMount() {
      if (showSearch) {
        inputRef.current?.focus();
      } else {
        listContainerRef.current?.focus();
      }
    },
    [showSearch],
  );

  useEffect(
    function scrollActiveIntoView() {
      if (activeIndex < 0) return;
      const list =
        listContainerRef.current?.querySelector("ul[role='listbox']");
      if (!list) return;
      const items = list.querySelectorAll<HTMLElement>("li[role='option']");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    },
    [activeIndex],
  );

  const findNextEnabled = useCallback(
    (start: number, direction: 1 | -1): number => {
      if (totalEntries === 0) return NO_INDEX;
      let i = start;
      for (let steps = 0; steps < totalEntries; steps++) {
        if (i < 0) i = totalEntries - 1;
        if (i >= totalEntries) i = 0;
        if (!filtered[i]?.disabled) return i;
        i += direction;
      }
      return NO_INDEX;
    },
    [filtered, totalEntries],
  );

  const toggleActive = useCallback(() => {
    if (activeIndex < 0 || activeIndex >= filtered.length) return;
    const opt = filtered[activeIndex];
    if (opt.disabled) return;
    onToggle(opt.value);
  }, [activeIndex, filtered, onToggle]);

  const typedPrefixRef = useRef("");
  const typedPrefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const handleTypeAhead = useCallback(
    (char: string) => {
      if (showSearch) {
        setQuery((prev) => prev + char);
        setActiveIndex(0);
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      if (typedPrefixTimerRef.current) {
        clearTimeout(typedPrefixTimerRef.current);
      }
      typedPrefixRef.current += char.toLowerCase();
      const prefix = typedPrefixRef.current;
      const matchIdx = filtered.findIndex(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(prefix),
      );
      if (matchIdx >= 0) setActiveIndex(matchIdx);
      typedPrefixTimerRef.current = setTimeout(() => {
        typedPrefixRef.current = "";
      }, TYPE_AHEAD_RESET_MS);
    },
    [showSearch, filtered],
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
      if (e.key === "PageDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          findNextEnabled(
            Math.min((prev < 0 ? 0 : prev) + PAGE_SIZE, totalEntries - 1),
            1,
          ),
        );
        return;
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          findNextEnabled(Math.max((prev < 0 ? 0 : prev) - PAGE_SIZE, 0), -1),
        );
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(findNextEnabled(0, 1));
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(findNextEnabled(totalEntries - 1, -1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        toggleActive();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key !== " "
      ) {
        if (e.target === inputRef.current) return;
        e.preventDefault();
        handleTypeAhead(e.key);
      }
    },
    [totalEntries, toggleActive, findNextEnabled, handleTypeAhead, onClose],
  );

  return (
    <div
      ref={listContainerRef}
      tabIndex={showSearch ? -1 : 0}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setActiveIndex(NO_INDEX)}
      className="outline-hidden flex flex-col min-h-0"
    >
      {showSearch && (
        <div className={clsx("p-2", (showList || showSearch) && "border-b")}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(e.target.value.trim() ? 0 : NO_INDEX);
            }}
            placeholder={searchPlaceholder ?? ui.searchPlaceholder}
            className="w-full h-8 px-2 text-size-base border rounded-sm outline-hidden border-strong focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
      )}
      {(showList || showSearch) && (
        <div
          style={listAreaStyle}
          className="outline-hidden min-h-0 overflow-auto scroll-shadows [scrollbar-width:thin]"
        >
          {!showList && (
            <div className="px-2 py-2 text-subtle">{ui.noResultsLabel}</div>
          )}
          <ul
            role="listbox"
            aria-multiselectable="true"
            tabIndex={-1}
            className="p-1"
          >
            {filtered.map((option, i) => {
              const isOptionDisabled = !!option.disabled;
              const isSelected = selectedSet.has(option.value);
              return (
                <li
                  key={String(option.value)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isOptionDisabled}
                  className={clsx(
                    "flex items-center gap-2 h-8 px-2 rounded-sm",
                    isOptionDisabled
                      ? "cursor-default text-disabled"
                      : "cursor-pointer text-default",
                    !isOptionDisabled && i === activeIndex && "bg-base-hover",
                    !isOptionDisabled &&
                      i !== activeIndex &&
                      "hover:bg-base-hover",
                    listClassName,
                  )}
                  onMouseEnter={
                    isOptionDisabled ? undefined : () => setActiveIndex(i)
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={
                    isOptionDisabled ? undefined : () => onToggle(option.value)
                  }
                >
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "flex items-center justify-center w-4 h-4 rounded-xs border shrink-0",
                      isSelected
                        ? "bg-accent-tint border-accent"
                        : "border-strong",
                    )}
                  >
                    {isSelected && (
                      <CheckIcon size={12} className="text-accent" />
                    )}
                  </span>
                  <span className="text-nowrap overflow-hidden text-ellipsis">
                    {option.description ?? option.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
