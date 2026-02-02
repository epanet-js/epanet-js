import React, {
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
import { CellProps, GridColumn } from "../types";

export type FilterableSelectOption<T extends string | number = string> = {
  value: T;
  label: string;
};

type FilterableSelectCellProps<T extends string | number = string | number> = {
  options: FilterableSelectOption<T>[];
  placeholder: string;
  minOptionsForSearch?: number;
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
  options: FilterableSelectOption<string | number>[],
  query: string,
): FilterableSelectOption<string | number>[] {
  if (!query.trim()) {
    return options;
  }
  const lowerQuery = query.toLowerCase();
  return options.filter((opt) => opt.label.toLowerCase().includes(lowerQuery));
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

export function FilterableSelectCell({
  value,
  onChange,
  stopEditing,
  isActive,
  isEditing,
  readOnly,
  options,
  placeholder,
  minOptionsForSearch = 8,
}: CellProps<string | number | null> &
  FilterableSelectCellProps<string | number>) {
  const showSearch = options.length >= minOptionsForSearch;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOptions = useMemo(
    () => filterOptions(options, searchQuery),
    [options, searchQuery],
  );

  const isNavigating = activeIndex >= 0;

  const setMode = useCallback((mode: "search" | "selection") => {
    setActiveIndex(mode === "search" ? -1 : 0);
  }, []);

  useEffect(
    function resetStateOnPopoverVisibilityChange() {
      if (open) {
        setMode("search");
        requestAnimationFrame(() => {
          if (showSearch) {
            searchInputRef.current?.focus();
          } else {
            listContainerRef.current?.focus();
          }
        });
      } else {
        // Reset when closing
        setSearchQuery("");
      }
    },
    [open, showSearch, setMode],
  );

  const closePopover = useCallback(() => {
    setOpen(false);
    stopEditing();
  }, [stopEditing]);

  const commit = useCallback(
    (option: FilterableSelectOption<string | number>) => {
      onChange(option.value);
      setOpen(false);
      stopEditing();
    },
    [onChange, stopEditing],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setMode("search");
    },
    [setMode],
  );

  // Unified keyboard handler for the popover content
  const handlePopoverKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Navigation keys - always handle
      if (LIST_NAVIGATION_KEYS.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (filteredOptions.length > 0) {
          setActiveIndex((prev) => {
            // If starting from search mode, go to first or last item
            if (prev === -1) {
              if (e.key === "ArrowUp" || e.key === "End") {
                return filteredOptions.length - 1;
              }
              return 0;
            }
            return (
              calculateNextListIndex(e.key, prev, filteredOptions.length) ??
              prev
            );
          });
        }
        return;
      }

      // Enter - commit if navigating, otherwise start navigation
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (isNavigating && filteredOptions[activeIndex]) {
          commit(filteredOptions[activeIndex]);
        } else if (filteredOptions.length > 0) {
          setActiveIndex(0);
        }
        return;
      }

      // Escape - go back to search mode or close
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        if (isNavigating && showSearch) {
          setMode("search");
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        } else {
          closePopover();
        }
        return;
      }

      // Tab - close without committing
      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        closePopover();
        return;
      }

      // Backspace/Delete - stop propagation to prevent grid from handling it
      if (showSearch && (e.key === "Backspace" || e.key === "Delete")) {
        e.stopPropagation();
        if (isNavigating) {
          setMode("search");
          searchInputRef.current?.focus();
        }
        // Don't prevent default - let key work on input
        return;
      }

      // Character keys while navigating - go to search mode and type
      if (
        isNavigating &&
        showSearch &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        setMode("search");
        searchInputRef.current?.focus();
        // Don't prevent default - let character be typed
      }
    },
    [
      filteredOptions,
      activeIndex,
      isNavigating,
      showSearch,
      commit,
      closePopover,
      setMode,
    ],
  );

  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const EXCLUDED_KEYS = [
        "ArrowUp",
        "ArrowLeft",
        "ArrowDown",
        "Esc",
        "Delete",
        "Backspace",
        "Tab",
      ];

      if (
        EXCLUDED_KEYS.includes(e.key) ||
        !e.ctrlKey ||
        !e.metaKey ||
        !e.altKey
      )
        return;

      e.preventDefault();
      setOpen(true);

      // Character keys - open popover and start filtering (if search is enabled)
      if (showSearch) {
        e.stopPropagation();
        setSearchQuery(e.key);
      }
    },
    [showSearch],
  );

  useEffect(
    function syncCellIsActive() {
      if (isActive) {
        buttonRef.current?.focus();
      } else {
        setOpen(false);
      }
    },
    [isActive],
  );

  // Open popover when grid enters editing mode (e.g., second click on active cell)
  useEffect(
    function syncCellIsEditing() {
      if (isEditing && !open) {
        setOpen(true);
      }
    },
    [isEditing, open],
  );

  if (readOnly) {
    return (
      <div className="w-full h-full flex items-center pl-2 text-sm text-gray-700">
        <span className="truncate">{selectedOption?.label ?? ""}</span>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full"
      style={{ pointerEvents: isActive ? "auto" : "none" }}
    >
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            ref={buttonRef}
            type="button"
            tabIndex={-1}
            onKeyDown={handleTriggerKeyDown}
            className="w-full h-full pl-2 flex items-center justify-between gap-1 text-sm text-gray-700 bg-transparent border-none outline-none text-left min-w-0"
          >
            <span
              className={clsx("truncate", !selectedOption && "text-gray-400")}
            >
              {selectedOption?.label ?? placeholder}
            </span>
            <div className="pl-1">
              <ChevronDownIcon />
            </div>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            className="bg-white min-w-[180px] border text-sm rounded-md shadow-md z-50 mt-1"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              buttonRef.current?.focus();
            }}
            onPointerDownOutside={(e) => {
              // Don't close if clicking the trigger button (it will toggle via Radix)
              if (buttonRef.current?.contains(e.target as Node)) {
                return;
              }
              setOpen(false);
            }}
            onEscapeKeyDown={(e) => {
              // Prevent Radix from handling escape - we handle it in handlePopoverKeyDown
              e.preventDefault();
            }}
          >
            <div
              ref={listContainerRef}
              tabIndex={showSearch ? -1 : 0}
              onKeyDown={handlePopoverKeyDown}
              className="outline-none"
            >
              {showSearch && (
                <div className="p-2 border-b border-gray-200">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search..."
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              )}
              <OptionsList
                options={filteredOptions}
                activeIndex={activeIndex}
                selected={value}
                onActiveIndexChange={setActiveIndex}
                onSelect={commit}
              />
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

type OptionsListProps = {
  options: FilterableSelectOption<string | number>[];
  activeIndex: number;
  selected: string | number | null;
  onActiveIndexChange: (index: number) => void;
  onSelect: (option: FilterableSelectOption<string | number>) => void;
};

const OptionsList: FunctionComponent<OptionsListProps> = ({
  options,
  activeIndex,
  selected,
  onActiveIndexChange,
  onSelect,
}) => {
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(
    function keepActiveItemVisible() {
      if (!listRef.current) return;

      if (activeIndex < 0) {
        listRef.current.scrollTop = 0;
        return;
      }

      const activeItem = listRef.current.children[activeIndex] as HTMLElement;
      activeItem?.scrollIntoView({ block: "nearest" });
    },
    [activeIndex],
  );

  const preventFocusOnListItem = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (options.length === 0) {
    return null;
  }

  return (
    <ul
      ref={listRef}
      tabIndex={-1}
      role="listbox"
      className="outline-none max-h-56 overflow-auto p-1"
    >
      {options.map((option, index) => (
        <Option
          key={option.value}
          option={option}
          index={index}
          isActive={index === activeIndex}
          isSelected={option.value === selected}
          onMouseEnter={onActiveIndexChange}
          onMouseDown={preventFocusOnListItem}
          onClick={onSelect}
        />
      ))}
    </ul>
  );
};

type OptionProps = {
  option: FilterableSelectOption<string | number>;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onMouseEnter: (index: number) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (option: FilterableSelectOption<string | number>) => void;
};

const Option: FunctionComponent<OptionProps> = ({
  option,
  index,
  isActive,
  isSelected,
  onMouseEnter,
  onMouseDown,
  onClick,
}) => {
  return (
    <li
      role="option"
      aria-selected={isSelected}
      className={clsx(
        "flex items-center justify-between gap-4 px-2 py-2 cursor-pointer text-gray-700 rounded",
        isActive && "bg-purple-300/40",
        !isActive && "hover:bg-gray-100",
      )}
      onMouseEnter={() => onMouseEnter(index)}
      onMouseDown={onMouseDown}
      onClick={() => onClick(option)}
    >
      <span>{option.label}</span>
      {isSelected && <CheckIcon className="text-purple-700 flex-shrink-0" />}
    </li>
  );
};

export function filterableSelectColumn<T extends string | number = string>(
  accessorKey: string,
  options: {
    header: string;
    size?: number;
    options: FilterableSelectOption<T>[];
    placeholder?: string;
    deleteValue?: T | null;
    minOptionsForSearch?: number;
  },
): GridColumn {
  return {
    accessorKey,
    header: options.header,
    size: options.size,
    cellComponent: (props: CellProps<string | number | null>) => (
      <FilterableSelectCell
        {...props}
        options={options.options as FilterableSelectOption<string | number>[]}
        placeholder={options.placeholder ?? ""}
        minOptionsForSearch={options.minOptionsForSearch}
      />
    ),
    copyValue: (v) => {
      const match = options.options.find((opt) => opt.value === v);
      return match?.label ?? "";
    },
    pasteValue: (v) => {
      const match = options.options.find(
        (opt) =>
          String(opt.value) === v ||
          opt.label.toLowerCase() === v.toLowerCase(),
      );
      return match ? match.value : null;
    },
    deleteValue: options.deleteValue ?? null,
  };
}
