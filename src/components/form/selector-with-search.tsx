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

export type SelectorWithSearchOption = {
  value: string;
  label: string;
};

const PAGE_SIZE = 5;
const LIST_NAVIGATION_KEYS = [
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
];

function filterOptions(
  options: SelectorWithSearchOption[],
  query: string,
): SelectorWithSearchOption[] {
  if (!query.trim()) return options;
  const lower = query.toLowerCase();
  return options.filter((o) => o.label.toLowerCase().includes(lower));
}

function calculateNextListIndex(
  key: string,
  prev: number,
  total: number,
): number | null {
  switch (key) {
    case "ArrowDown":
      return prev < 0 ? 0 : Math.min(prev + 1, total - 1);
    case "ArrowUp":
      return prev <= 0 ? total - 1 : prev - 1;
    case "PageDown":
      return Math.min(prev < 0 ? PAGE_SIZE - 1 : prev + PAGE_SIZE, total - 1);
    case "PageUp":
      return Math.max(prev - PAGE_SIZE, 0);
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
}

export const SelectorWithSearch: FunctionComponent<{
  options: SelectorWithSearchOption[];
  selected: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  ariaLabel?: string;
}> = ({ options, selected, onChange, placeholder = "", ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === selected) ?? null,
    [options, selected],
  );

  const filteredOptions = useMemo(
    () => filterOptions(options, searchQuery),
    [options, searchQuery],
  );

  useEffect(
    function resetOnOpen() {
      if (open) {
        setSearchQuery("");
        const idx = options.findIndex((o) => o.value === selected);
        setActiveIndex(idx >= 0 ? idx : -1);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    },
    [open, options, selected],
  );

  const commit = useCallback(
    (option: SelectorWithSearchOption | null) => {
      onChange(option?.value ?? null);
      setOpen(false);
    },
    [onChange],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setActiveIndex(0);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (LIST_NAVIGATION_KEYS.includes(e.key)) {
        e.preventDefault();
        setActiveIndex(
          (prev) =>
            calculateNextListIndex(e.key, prev, filteredOptions.length) ?? prev,
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commit(filteredOptions[activeIndex] ?? null);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        commit(filteredOptions[activeIndex] ?? null);
      }
    },
    [filteredOptions, activeIndex, commit],
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
              !selectedOption && "italic text-gray-500",
            )}
          >
            {selectedOption?.label ?? placeholder}
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
          className="bg-white min-w-[var(--radix-popover-trigger-width)] border text-sm rounded-md shadow-md z-50 mt-1"
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
            onKeyDown={handleKeyDown}
            className="outline-none"
          >
            <div className="p-2 border-b border-gray-200">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search…"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <OptionsList
              options={filteredOptions}
              activeIndex={activeIndex}
              selected={selected}
              onActiveIndexChange={setActiveIndex}
              onSelect={commit}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

const OptionsList: FunctionComponent<{
  options: SelectorWithSearchOption[];
  activeIndex: number;
  selected: string | null;
  onActiveIndexChange: (index: number) => void;
  onSelect: (option: SelectorWithSearchOption) => void;
}> = ({ options, activeIndex, selected, onActiveIndexChange, onSelect }) => {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(
    function keepActiveItemVisible() {
      if (!listRef.current) return;
      if (activeIndex < 0) {
        listRef.current.scrollTop = 0;
        return;
      }
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    },
    [activeIndex],
  );

  if (options.length === 0) {
    return <p className="px-3 py-2 text-sm text-gray-400 italic">No results</p>;
  }

  return (
    <ul
      ref={listRef}
      tabIndex={-1}
      role="listbox"
      className="outline-none max-h-56 overflow-auto p-1"
    >
      {options.map((option, index) => (
        <li
          key={option.value}
          role="option"
          aria-selected={option.value === selected}
          className={clsx(
            "flex items-center justify-between gap-4 px-2 py-2 cursor-pointer text-gray-700 rounded",
            index === activeIndex && "bg-purple-300/40",
            index !== activeIndex && "hover:bg-gray-100",
          )}
          onMouseEnter={() => onActiveIndexChange(index)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(option)}
        >
          <span>{option.label}</span>
          {option.value === selected && (
            <CheckIcon className="text-purple-700 flex-shrink-0" />
          )}
        </li>
      ))}
    </ul>
  );
};
