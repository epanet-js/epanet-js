import { useState, useRef, useCallback, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useVirtualizer } from "@tanstack/react-virtual";
import clsx from "clsx";
import { SearchableSelectorOption } from "./searchable-selector";

const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 5;

export const VirtualizedSearchableSelector = <
  T extends SearchableSelectorOption,
>({
  selected,
  onChange,
  onSearch,
  placeholder,
  label,
  disabled = false,
  autoFocus = false,
  wrapperClassName,
  renderOption,
  leadingIcon,
}: {
  selected?: T;
  onChange: (option: T) => void;
  onSearch: (query: string) => Promise<T[]>;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  wrapperClassName?: string;
  renderOption?: (option: T) => React.ReactNode;
  leadingIcon?: React.ReactNode;
}) => {
  const [searchTerm, setSearchTerm] = useState(selected?.label || "");
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null,
  );

  const inputRef = useRef<HTMLInputElement | null>(null);

  const virtualizer = useVirtualizer({
    count: suggestions.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  useEffect(
    function keepActiveItemVisible() {
      if (activeIndex < 0) return;
      virtualizer.scrollToIndex(activeIndex, { align: "auto" });
    },
    [activeIndex, virtualizer],
  );

  const search = useCallback(
    async (query: string) => {
      if (query.trim().length < 1) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await onSearch(query);
        setSuggestions(results);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [onSearch],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchTerm(value);
      setActiveIndex(-1);
      void search(value);
    },
    [search],
  );

  const commit = useCallback(
    (option: T) => {
      onChange(option);
      setSearchTerm(option.label);
      setOpen(false);
      setActiveIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!open && suggestions.length > 0) setOpen(true);
        setActiveIndex((prev) =>
          prev < 0 ? 0 : Math.min(prev + 1, suggestions.length - 1),
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!open && suggestions.length > 0) setOpen(true);
        setActiveIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1,
        );
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (open && activeIndex >= 0) {
          commit(suggestions[activeIndex]);
        } else if (searchTerm.trim()) {
          void search(searchTerm);
        }
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }

      if (e.key === "Tab") {
        if (open && activeIndex >= 0) {
          commit(suggestions[activeIndex]);
        }
        setOpen(false);
        setActiveIndex(-1);
      }
    },
    [open, suggestions, activeIndex, commit, search, searchTerm],
  );

  const handleOptionMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const scrollerHeight =
    Math.min(suggestions.length, VISIBLE_ROWS) * ROW_HEIGHT;

  return (
    <label className={wrapperClassName ?? "block pt-2 space-y-2 pb-3"}>
      {label && (
        <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
          {label}
        </div>
      )}

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Anchor asChild>
          <div className="relative w-full">
            {leadingIcon && (
              <div
                aria-hidden
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none flex items-center"
              >
                {leadingIcon}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              spellCheck={false}
              autoFocus={autoFocus}
              autoComplete="off"
              className={clsx(
                "flex items-center gap-x-2 w-full min-w-[90px]",
                "border rounded-sm border-gray-200 py-2 text-sm",
                "placeholder:italic",
                leadingIcon ? "pl-8 pr-2" : "px-2",
                "outline-none focus:outline-none focus-visible:outline-none",
                disabled
                  ? "cursor-not-allowed bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-500"
                  : "text-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10 focus:border-transparent",
              )}
            />

            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
              </div>
            )}
          </div>
        </Popover.Anchor>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            className="bg-white dark:bg-gray-800 w-[var(--anchor-width,100%)] min-w-[220px] border dark:border-gray-600 text-sm rounded-md shadow-md z-50 mt-1 p-1"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onEscapeKeyDown={() => setOpen(false)}
            onPointerDownOutside={() => setOpen(false)}
            onMouseDown={(e) => e.preventDefault()}
            style={{
              ["--anchor-width" as any]: `${inputRef.current?.offsetWidth ?? 0}px`,
            }}
          >
            {suggestions.length === 0 && !isSearching ? (
              <div className="px-2 py-2 text-gray-400">No results</div>
            ) : (
              <div
                ref={setScrollElement}
                className="overflow-y-auto"
                style={{ height: scrollerHeight }}
                role="listbox"
                aria-label={label}
              >
                <div
                  style={{
                    height: virtualizer.getTotalSize(),
                    position: "relative",
                    width: "100%",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const index = virtualRow.index;
                    const suggestion = suggestions[index];
                    return (
                      <div
                        key={suggestion.id}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={clsx(
                          "absolute left-0 right-0 px-2 py-2 cursor-pointer text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded",
                          index === activeIndex && "bg-purple-300/40",
                        )}
                        style={{
                          height: ROW_HEIGHT,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={handleOptionMouseDown}
                        onClick={() => commit(suggestion)}
                      >
                        {renderOption
                          ? renderOption(suggestion)
                          : suggestion.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </label>
  );
};
