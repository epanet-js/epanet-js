import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDownIcon } from "../icons";
import { useSelectorPortalContainer } from "../portal";
import { useUIConfig } from "../ui-config";
import { StyleOptions, triggerStylesFor } from "./selector-trigger";
import type { SelectorListOption } from "./selector-list";
import { MultiSelectorRow } from "./multi-selector-row";

export type SearchResults<T extends string | number> = {
  options: SelectorListOption<T>[];
  /** False when the search found more than it returns, so `options` is a
   *  sample: the list then asks for a narrower query instead of showing it. */
  complete: boolean;
};

export type SearchableMultiSelectorProps<T extends string | number> = {
  selected: T[];
  onChange: (next: T[]) => void;
  /** Runs for the typed query, the empty one included. Abandon the work once
   *  `signal` aborts: a newer query, or the list closing, replaces it. */
  onSearch: (query: string, signal: AbortSignal) => Promise<SearchResults<T>>;
  /** Resolved trigger text when selected.length > 0. */
  valueLabel: string;
  /** Resolved empty-state text shown when selected.length === 0. */
  placeholder: string;
  /** Shown instead of the results when a search is not complete. */
  partialResultsLabel: string;
  /** The label of a selected value, for when no search result names it. */
  labelFor?: (value: T) => string;
  ariaLabel?: string;
  tabIndex?: number;
  styleOptions?: StyleOptions;
  triggerClassName?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  searchDebounceMs?: number;
  maxVisibleOptions?: number;
  side?: "top" | "bottom" | "auto";
};

const VIRTUALIZATION_THRESHOLD = 100;
const ROW_REM = 2;
const LIST_TOP_PAD_REM = 0.25;
const ROW_PX = 32;
const LIST_PAD_PX = 4;
const VIRTUAL_OVERSCAN = 8;

type Searched<T extends string | number> = {
  query: string;
  results: SearchResults<T>;
};

function SearchableMultiSelectorList<T extends string | number>({
  selected,
  onToggle,
  onClose,
  onSearch,
  labelFor,
  partialResultsLabel,
  searchPlaceholder,
  searchDebounceMs,
  maxVisibleOptions,
  ariaLabel,
}: {
  selected: T[];
  onToggle: (value: T) => void;
  onClose: () => void;
  onSearch: SearchableMultiSelectorProps<T>["onSearch"];
  labelFor?: (value: T) => string;
  partialResultsLabel: string;
  searchPlaceholder?: string;
  searchDebounceMs: number;
  maxVisibleOptions: number;
  ariaLabel?: string;
}) {
  const ui = useUIConfig();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<Searched<T> | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  useEffect(function focusSearchOnOpen() {
    inputRef.current?.focus();
  }, []);

  useEffect(
    function searchForQuery() {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        onSearchRef
          .current(query, controller.signal)
          .then((results) => setSearched({ query, results }))
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            if (error instanceof DOMException && error.name === "AbortError") {
              return;
            }
            setSearched({ query, results: { options: [], complete: true } });
          });
      }, searchDebounceMs);
      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    },
    [query, searchDebounceMs],
  );

  const isSearching = searched?.query !== query;
  const results = isSearching ? null : searched.results;
  const isPartial = results !== null && !results.complete;

  const labelOf = (value: T): string =>
    searched?.results.options.find((option) => option.value === value)?.label ??
    labelFor?.(value) ??
    String(value);

  const selectedRows: SelectorListOption<T>[] = selected.map((value) => ({
    value,
    label: labelOf(value),
  }));
  const resultRows =
    results && results.complete
      ? results.options.filter((option) => !selected.includes(option.value))
      : [];
  const rows = [...selectedRows, ...resultRows];

  const message = isSearching
    ? ui.searchingLabel
    : isPartial
      ? partialResultsLabel
      : resultRows.length === 0
        ? ui.noResultsLabel
        : null;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (rows.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((current) =>
          current < 0
            ? step === 1
              ? 0
              : rows.length - 1
            : (current + step + rows.length) % rows.length,
        );
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const row = rows[activeIndex];
        if (row && !row.disabled) onToggle(row.value);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    },
    [rows, activeIndex, onToggle, onClose],
  );

  const maxListHeight = `${(maxVisibleOptions + 0.5) * ROW_REM + LIST_TOP_PAD_REM}rem`;

  const virtualized = rows.length > VIRTUALIZATION_THRESHOLD;
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );
  const virtualizer = useVirtualizer({
    count: virtualized ? rows.length : 0,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_PX,
    overscan: VIRTUAL_OVERSCAN,
    paddingStart: LIST_PAD_PX,
    paddingEnd: LIST_PAD_PX,
  });

  useEffect(
    function scrollActiveIntoView() {
      if (activeIndex < 0) return;
      if (virtualized) {
        virtualizer.scrollToIndex(activeIndex, { align: "auto" });
        return;
      }
      document
        .getElementById(`${listId}-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    },
    [activeIndex, virtualized, virtualizer, listId],
  );

  const renderRow = (index: number, style?: React.CSSProperties) => {
    const option = rows[index];
    return (
      <MultiSelectorRow<T>
        key={String(option.value)}
        id={`${listId}-${index}`}
        option={option}
        isSelected={index < selectedRows.length}
        isActive={index === activeIndex}
        style={style}
        onActivate={() => setActiveIndex(index)}
        onToggle={onToggle}
      />
    );
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="p-2 border-b">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            rows[activeIndex] ? `${listId}-${activeIndex}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={searchPlaceholder ?? ui.searchPlaceholder}
          className="w-full h-8 px-2 text-size-base border rounded-sm outline-hidden border-strong focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>
      <div
        ref={setScrollElement}
        style={{ maxHeight: maxListHeight }}
        className="min-h-0 overflow-auto scroll-shadows [scrollbar-width:thin]"
      >
        {virtualized ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-multiselectable="true"
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((row) =>
              renderRow(row.index, {
                height: ROW_PX,
                transform: `translateY(${row.start}px)`,
              }),
            )}
          </ul>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-multiselectable="true"
            className="p-1"
          >
            {rows.map((_, index) => renderRow(index))}
          </ul>
        )}
        {message !== null && (
          <p
            role="status"
            className={clsx(
              "px-3 pb-2 text-size-base text-subtle",
              rows.length === 0 && "pt-1",
            )}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A multi-selector whose options come from an asynchronous search instead of
 * a known list: the selected values come first, then what the query found.
 */
export function SearchableMultiSelector<T extends string | number>({
  selected,
  onChange,
  onSearch,
  valueLabel,
  placeholder,
  partialResultsLabel,
  labelFor,
  ariaLabel,
  tabIndex = 0,
  styleOptions = {},
  triggerClassName,
  disabled = false,
  searchPlaceholder,
  searchDebounceMs = 150,
  maxVisibleOptions = 6,
  side = "auto",
}: SearchableMultiSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closedFromOutside = useRef(false);
  const portalContainer = useSelectorPortalContainer();

  const triggerStyles = triggerStylesFor(styleOptions, { disabled });

  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        setOpen(true);
      }
    },
    [disabled],
  );

  const handleToggle = useCallback(
    (value: T) => {
      onChange(
        selected.includes(value)
          ? selected.filter((kept) => kept !== value)
          : [...selected, value],
      );
    },
    [selected, onChange],
  );

  const isEmpty = selected.length === 0;

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
          onClick={() => !disabled && setOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
          className={clsx(triggerStyles, triggerClassName)}
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
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!closedFromOutside.current) buttonRef.current?.focus();
            closedFromOutside.current = false;
          }}
          onPointerDownOutside={(event) => {
            if (buttonRef.current?.contains(event.target as Node)) {
              event.preventDefault();
              return;
            }
            closedFromOutside.current = true;
          }}
        >
          {open && (
            <SearchableMultiSelectorList<T>
              selected={selected}
              onToggle={handleToggle}
              onClose={() => setOpen(false)}
              onSearch={onSearch}
              labelFor={labelFor}
              partialResultsLabel={partialResultsLabel}
              searchPlaceholder={searchPlaceholder}
              searchDebounceMs={searchDebounceMs}
              maxVisibleOptions={maxVisibleOptions}
              ariaLabel={ariaLabel}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
