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
  focus,
  options,
  placeholder,
}: CellProps<string | number | null> &
  FilterableSelectCellProps<string | number>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredOptions, setFilteredOptions] = useState<
    FilterableSelectOption<string | number>[]
  >(() => options);

  // Reset state when popover opens/closes
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setFilteredOptions(options);
      setActiveIndex(-1);
      // Focus search input when popover opens
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [open, options]);

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
      const query = e.target.value;
      setSearchQuery(query);
      const filtered = filterOptions(options, query);
      setFilteredOptions(filtered);
      setActiveIndex(query.trim() && filtered.length > 0 ? 0 : -1);
    },
    [options],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (LIST_NAVIGATION_KEYS.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (filteredOptions.length > 0) {
          setActiveIndex(
            (prev) =>
              calculateNextListIndex(e.key, prev, filteredOptions.length) ??
              prev,
          );
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredOptions.length > 0 && activeIndex >= 0) {
          commit(filteredOptions[activeIndex]);
        }
        return;
      }

      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        return;
      }

      if (e.key === "Tab") {
        if (filteredOptions.length > 0 && activeIndex >= 0) {
          commit(filteredOptions[activeIndex]);
        }
        setOpen(false);
      }
    },
    [filteredOptions, activeIndex, commit],
  );

  const handleButtonKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  }, []);

  // Handle focus from parent cell
  useEffect(() => {
    if (focus) {
      buttonRef.current?.focus();
    } else {
      buttonRef.current?.blur();
      setOpen(false);
    }
  }, [focus]);

  return (
    <div
      className="w-full h-full"
      style={{ pointerEvents: focus ? "auto" : "none" }}
    >
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            ref={buttonRef}
            type="button"
            tabIndex={-1}
            onKeyDown={handleButtonKeyDown}
            className="w-full h-full px-2 flex items-center justify-between gap-1 text-sm text-gray-700 bg-transparent border-none outline-none text-left min-w-0"
          >
            <span
              className={clsx("truncate", !selectedOption && "text-gray-400")}
            >
              {selectedOption?.label ?? placeholder}
            </span>
            <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            className="bg-white min-w-[180px] border text-sm rounded-md shadow-md z-50 mt-1"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onEscapeKeyDown={() => setOpen(false)}
            onPointerDownOutside={() => setOpen(false)}
          >
            <div className="p-2 border-b border-gray-200">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <OptionsList
              options={filteredOptions}
              activeIndex={activeIndex}
              selected={value}
              onActiveIndexChange={setActiveIndex}
              onSelect={commit}
            />
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
    return (
      <div className="p-3 text-sm text-gray-500 text-center">
        No options found
      </div>
    );
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
      />
    ),
    copyValue: (v) => String(v ?? ""),
    pasteValue: (v) => {
      const match = options.options.find(
        (opt) =>
          String(opt.value) === v ||
          opt.label.toLowerCase() === v.toLowerCase(),
      );
      return match ? match.value : null;
    },
    deleteValue: options.deleteValue ?? null,
    disableKeys: true,
  };
}
