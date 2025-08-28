import { useState, useRef, useCallback } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";

export type SearchableSelectorOption = {
  id: string;
  label: string;
  data?: any;
};

export const SearchableSelector = <T extends SearchableSelectorOption>({
  selected,
  onChange,
  onSearch,
  placeholder,
  label,
}: {
  selected?: T;
  onChange: (option: T) => void;
  onSearch: (query: string) => Promise<T[]>;
  placeholder?: string;
  label?: string;
}) => {
  const [searchTerm, setSearchTerm] = useState(selected?.label || "");
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const search = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
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
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onChange],
  );

  const moveActive = useCallback(
    (delta: number) => {
      if (!open || suggestions.length === 0) return;
      setActiveIndex((prev) => {
        let next = prev + delta;
        if (next < 0) next = suggestions.length - 1;
        if (next >= suggestions.length) next = 0;
        return next;
      });
    },
    [open, suggestions.length],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        if (!open && (isSearching || suggestions.length > 0)) setOpen(true);
        if (suggestions.length > 0) {
          e.preventDefault();
          setActiveIndex(0);
          requestAnimationFrame(() => listRef.current?.focus());
        }
        return;
      }

      if (e.key === "Tab" && !e.shiftKey) {
        if (open && suggestions.length > 0) {
          e.preventDefault();
          setActiveIndex(0);
          requestAnimationFrame(() => listRef.current?.focus());
        }
        return;
      }

      if (e.key === "Enter") {
        if (open && suggestions.length > 0) {
          e.preventDefault();
          commit(suggestions[0]);
        }
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
    },
    [open, isSearching, suggestions, commit],
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActive(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0) commit(suggestions[activeIndex]);
      } else if (e.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
        requestAnimationFrame(() => inputRef.current?.focus());
      } else if (e.key === "Tab") {
        setOpen(false);
        setActiveIndex(-1);
      }
    },
    [moveActive, activeIndex, commit, suggestions],
  );

  const handleOptionClick = useCallback(
    (option: T) => {
      commit(option);
    },
    [commit],
  );

  const handleOptionMouseEnter = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const handleOptionMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <label className="block pt-2 space-y-2 pb-3">
      {label && (
        <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
          {label}
        </div>
      )}

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Anchor asChild>
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="
                flex items-center gap-x-2 text-gray-700 w-full min-w-[90px]
                border rounded-sm border-gray-200 px-2 py-2 text-sm
                bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600
                outline-none focus:outline-none focus-visible:outline-none
                focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10 focus:border-transparent"
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
            className="bg-white w-[var(--anchor-width,100%)] min-w-[220px] border text-sm rounded-md shadow-md z-50 mt-1 max-h-60 overflow-auto p-1"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onEscapeKeyDown={() => setOpen(false)}
            onPointerDownOutside={() => setOpen(false)}
            style={{
              ["--anchor-width" as any]: `${inputRef.current?.offsetWidth ?? 0}px`,
            }}
          >
            {suggestions.length === 0 && !isSearching ? (
              <div className="px-2 py-2 text-gray-400">No results</div>
            ) : (
              <ul
                ref={listRef}
                tabIndex={0}
                role="listbox"
                aria-label={label}
                onKeyDown={handleListKeyDown}
                className="outline-none"
              >
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.id}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={clsx(
                      "px-2 py-2 cursor-pointer w-full text-left text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded",
                      index === activeIndex && "bg-purple-300/40",
                    )}
                    onMouseEnter={() => handleOptionMouseEnter(index)}
                    onMouseDown={handleOptionMouseDown}
                    onClick={() => handleOptionClick(suggestion)}
                  >
                    {suggestion.label}
                  </li>
                ))}
              </ul>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </label>
  );
};
