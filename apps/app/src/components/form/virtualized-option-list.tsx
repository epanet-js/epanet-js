import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { useUIConfig } from "@epanet-js/ui-kit";
import { CheckIcon } from "src/icons";

export type VirtualizedOption<T extends string | number | boolean> = {
  value: T;
  label: string;
};

const ROW_HEIGHT = 32;
const LIST_MAX_HEIGHT = 180;
const OVERSCAN = 8;
const NO_INDEX = -1;

export const VirtualizedOptionList = <T extends string | number | boolean>({
  label,
  options,
  selected,
  clearLabel,
  initialQuery = "",
  onCommit,
  onClose,
}: {
  label?: string;
  options: VirtualizedOption<T>[];
  selected: T | null;
  clearLabel?: string;
  initialQuery?: string;
  onCommit: (value: T | null) => void;
  onClose: () => void;
}) => {
  const ui = useUIConfig();
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(() =>
    initialQuery.trim()
      ? 0
      : options.findIndex((option) => option.value === selected),
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
                  key={String(option.value)}
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
