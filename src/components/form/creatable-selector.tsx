import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  FunctionComponent,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { CheckIcon, ChevronDownIcon } from "src/icons";
import { triggerStylesFor } from "./selector";

export type CreatableSelectorProps = {
  options: string[];
  selected: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  ariaLabel?: string;
  searchPlaceholder?: string;
  createLabel?: (query: string) => string;
  clearLabel?: string;
};

const NO_INDEX = -1;

export const CreatableSelector: FunctionComponent<CreatableSelectorProps> = ({
  options,
  selected,
  onChange,
  placeholder = "",
  ariaLabel,
  searchPlaceholder = "Search…",
  createLabel = (query) => `Add "${query}"`,
  clearLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(NO_INDEX);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    if (!trimmedQuery) return options;
    const q = trimmedQuery.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, trimmedQuery]);

  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false;
    const q = trimmedQuery.toLowerCase();
    return options.some((o) => o.toLowerCase() === q);
  }, [options, trimmedQuery]);

  const showCreateOption = trimmedQuery.length > 0 && !hasExactMatch;
  const totalEntries = filtered.length + (showCreateOption ? 1 : 0);

  useEffect(
    function resetOnOpen() {
      if (!open) return;
      setQuery("");
      const idx = selected === null ? NO_INDEX : options.indexOf(selected);
      setActiveIndex(idx);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [open, options, selected],
  );

  const commit = useCallback(
    (value: string | null) => {
      onChange(value);
      setOpen(false);
    },
    [onChange],
  );

  const commitActive = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < filtered.length) {
      commit(filtered[activeIndex]);
      return;
    }
    if (showCreateOption) {
      commit(trimmedQuery);
      return;
    }
    if (!trimmedQuery && filtered.length > 0) {
      commit(filtered[0]);
    }
  }, [activeIndex, filtered, showCreateOption, trimmedQuery, commit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          totalEntries === 0
            ? NO_INDEX
            : prev < 0
              ? 0
              : Math.min(prev + 1, totalEntries - 1),
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          totalEntries === 0
            ? NO_INDEX
            : prev <= 0
              ? totalEntries - 1
              : prev - 1,
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
    [totalEntries, commitActive],
  );

  const triggerStyles = useMemo(() => triggerStylesFor({}), []);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          ref={buttonRef}
          type="button"
          aria-label={ariaLabel}
          className={triggerStyles}
        >
          <div
            className={clsx(
              "text-nowrap overflow-hidden text-ellipsis w-full text-left",
              !selected && "italic text-gray-500",
            )}
          >
            {selected ?? placeholder}
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
          <div onKeyDown={handleKeyDown} className="outline-hidden">
            <div className="p-2 border-b border-gray-200">
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
            <ul
              role="listbox"
              tabIndex={-1}
              className="outline-hidden max-h-56 overflow-auto p-1"
            >
              {filtered.length === 0 && !showCreateOption && (
                <li className="px-3 py-2 text-sm text-gray-400 italic">
                  No results
                </li>
              )}
              {filtered.map((opt, i) => (
                <li
                  key={opt}
                  role="option"
                  aria-selected={opt === selected}
                  className={clsx(
                    "flex items-center justify-between gap-4 px-2 py-2 cursor-pointer text-gray-700 rounded-sm",
                    i === activeIndex && "bg-purple-300/40",
                    i !== activeIndex && "hover:bg-gray-100",
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(opt)}
                >
                  <span>{opt}</span>
                  {opt === selected && (
                    <CheckIcon className="text-purple-700 shrink-0" />
                  )}
                </li>
              ))}
              {showCreateOption && (
                <li
                  role="option"
                  className={clsx(
                    "flex items-center px-2 py-2 cursor-pointer text-purple-700 rounded-sm",
                    filtered.length > 0 && "border-t border-gray-100 mt-1 pt-2",
                    activeIndex === filtered.length && "bg-purple-300/40",
                    activeIndex !== filtered.length && "hover:bg-gray-100",
                  )}
                  onMouseEnter={() => setActiveIndex(filtered.length)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(trimmedQuery)}
                >
                  {createLabel(trimmedQuery)}
                </li>
              )}
            </ul>
            {selected !== null && (
              <button
                type="button"
                className="block w-full text-left px-3 py-2 text-sm italic text-gray-500 border-t border-gray-100 hover:bg-gray-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(null)}
              >
                {clearLabel ?? placeholder}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
