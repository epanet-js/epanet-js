import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import clsx from "clsx";
import { CheckIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";

export type SelectorListOption<T extends string | number | boolean> = {
  label: string;
  description?: string;
  value: T;
  disabled?: boolean;
};

export type SelectorListProps<T extends string | number | boolean> = {
  options: SelectorListOption<T>[];
  selected: T | null;
  onCommit: (value: T | null) => void;
  onClose: () => void;
  onActionClick?: () => void;

  actionLabel?: string;
  clearLabel?: string;
  nullable?: boolean;
  allowNew?: boolean;
  createLabel?: (query: string) => string;
  minOptionsForSearch?: number;
  searchPlaceholder?: string;
  listClassName?: string;

  /** Seed the search query on mount (used by data-grid type-to-open). */
  initialQuery?: string;
};

const NO_INDEX = -1;
const PAGE_SIZE = 5;
const TYPE_AHEAD_RESET_MS = 500;

export function SelectorList<T extends string | number | boolean>(
  props: SelectorListProps<T>,
) {
  const translate = useTranslate();
  return (
    <BaseSelectorList
      {...props}
      searchPlaceholder={props.searchPlaceholder ?? translate("search")}
      createLabel={
        props.createLabel ?? ((query) => translate("addNewValue", query))
      }
    />
  );
}

export function BaseSelectorList<T extends string | number | boolean>({
  options,
  selected,
  onCommit,
  onClose,
  onActionClick,
  actionLabel,
  clearLabel,
  nullable = false,
  allowNew = false,
  createLabel,
  minOptionsForSearch = 8,
  searchPlaceholder,
  listClassName,
  initialQuery = "",
}: SelectorListProps<T>) {
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    if (selected === null) return NO_INDEX;
    const idx = options.findIndex((o) => o.value === selected);
    return idx >= 0 ? idx : NO_INDEX;
  });
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
  const showClearRow =
    nullable && clearLabel !== undefined && options.length > 0;
  const showActionRow =
    actionLabel !== undefined && onActionClick !== undefined;
  const showList = filtered.length > 0 || showCreateOption;

  const createIdx = showCreateOption ? filtered.length : -1;
  const clearIdx = showClearRow
    ? filtered.length + (showCreateOption ? 1 : 0)
    : -1;
  const actionIdx = showActionRow
    ? filtered.length + (showCreateOption ? 1 : 0) + (showClearRow ? 1 : 0)
    : -1;
  const totalEntries =
    filtered.length +
    (showCreateOption ? 1 : 0) +
    (showClearRow ? 1 : 0) +
    (showActionRow ? 1 : 0);

  useEffect(
    function focusOnMount() {
      const id = requestAnimationFrame(() => {
        if (showSearch) {
          inputRef.current?.focus();
        } else {
          listContainerRef.current?.focus();
        }
      });
      return () => cancelAnimationFrame(id);
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

  const triggerAction = useCallback(() => {
    onActionClick?.();
    onClose();
  }, [onActionClick, onClose]);

  const commitActive = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < filtered.length) {
      const opt = filtered[activeIndex];
      if (opt.disabled) return;
      onCommit(opt.value);
      return;
    }
    if (activeIndex === createIdx && showCreateOption) {
      onCommit(trimmedQuery as T);
      return;
    }
    if (activeIndex === clearIdx && showClearRow) {
      onCommit(null);
      return;
    }
    if (activeIndex === actionIdx && showActionRow) {
      triggerAction();
      return;
    }
    if (filtered.length === 1 && !filtered[0].disabled) {
      onCommit(filtered[0].value);
      return;
    }
    if (
      filtered.length === 0 &&
      !showCreateOption &&
      !showClearRow &&
      showActionRow
    ) {
      triggerAction();
    }
  }, [
    activeIndex,
    filtered,
    showCreateOption,
    showClearRow,
    showActionRow,
    createIdx,
    clearIdx,
    actionIdx,
    trimmedQuery,
    onCommit,
    triggerAction,
  ]);

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
      if (e.key === "Tab") {
        e.preventDefault();
        type Region = "search" | "options" | "clear" | "action";
        const regions: Region[] = [];
        if (showSearch) regions.push("search");
        if (showList) regions.push("options");
        if (showClearRow) regions.push("clear");
        if (showActionRow) regions.push("action");
        if (regions.length === 0) return;

        if (regions.length === 1 && regions[0] === "options") {
          setActiveIndex((prev) =>
            e.shiftKey
              ? findNextEnabled(prev <= 0 ? totalEntries - 1 : prev - 1, -1)
              : findNextEnabled(
                  prev < 0 ? 0 : Math.min(prev + 1, totalEntries - 1),
                  1,
                ),
          );
          return;
        }

        const currentRegion: Region | null =
          showSearch && activeIndex === NO_INDEX
            ? "search"
            : activeIndex === clearIdx
              ? "clear"
              : activeIndex === actionIdx
                ? "action"
                : activeIndex >= 0
                  ? "options"
                  : null;

        const direction = e.shiftKey ? -1 : 1;
        const currentIdx =
          currentRegion === null ? -1 : regions.indexOf(currentRegion);
        const targetIdx =
          currentRegion === null
            ? direction === 1
              ? 0
              : regions.length - 1
            : (currentIdx + direction + regions.length) % regions.length;
        const target = regions[targetIdx];

        switch (target) {
          case "search":
            setActiveIndex(NO_INDEX);
            inputRef.current?.focus();
            break;
          case "options":
            setActiveIndex(
              direction === 1
                ? findNextEnabled(0, 1)
                : findNextEnabled(filtered.length - 1, -1),
            );
            break;
          case "clear":
            setActiveIndex(clearIdx);
            break;
          case "action":
            setActiveIndex(actionIdx);
            break;
        }
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
    [
      totalEntries,
      commitActive,
      findNextEnabled,
      handleTypeAhead,
      onClose,
      showSearch,
      showList,
      showClearRow,
      showActionRow,
      activeIndex,
      clearIdx,
      actionIdx,
      filtered.length,
    ],
  );

  return (
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
            (showList || showClearRow || showActionRow) && "border-b",
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
            className="w-full h-8 px-2 text-size-base border border-strong rounded-sm outline-hidden focus:border-accent focus:ring-1 focus:ring-accent"
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
                    "flex items-center justify-between gap-4 h-8 px-2 rounded-sm",
                    isOptionDisabled
                      ? "cursor-default text-gray-400"
                      : "cursor-pointer text-default",
                    !isOptionDisabled &&
                      i === activeIndex &&
                      "bg-purple-300/40",
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
                    isOptionDisabled ? undefined : () => onCommit(option.value)
                  }
                >
                  <span>{option.description ?? option.label}</span>
                  {option.value === selected && (
                    <CheckIcon className="text-accent shrink-0" />
                  )}
                </li>
              );
            })}
            {showCreateOption && (
              <li
                role="option"
                className={clsx(
                  "flex items-center h-8 px-2 cursor-pointer text-accent rounded-sm",
                  filtered.length > 0 && "border-t border-gray-100 mt-1",
                  activeIndex === filtered.length && "bg-purple-300/40",
                  activeIndex !== filtered.length && "hover:bg-base-hover",
                )}
                onMouseEnter={() => setActiveIndex(filtered.length)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onCommit(trimmedQuery as T)}
              >
                {createLabel?.(trimmedQuery) ?? trimmedQuery}
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
            className={clsx(
              "flex items-center justify-between gap-4 w-full h-8 px-2 italic cursor-pointer text-default rounded-sm",
              activeIndex === clearIdx
                ? "bg-purple-300/40"
                : "hover:bg-purple-300/40",
            )}
            onMouseEnter={() => setActiveIndex(clearIdx)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCommit(null)}
          >
            {clearLabel}
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
            className={clsx(
              "flex items-center justify-between gap-4 w-full h-8 px-2 cursor-pointer text-default rounded-sm",
              activeIndex === actionIdx
                ? "bg-purple-300/40"
                : "hover:bg-purple-300/40",
            )}
            onMouseEnter={() => setActiveIndex(actionIdx)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={triggerAction}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
