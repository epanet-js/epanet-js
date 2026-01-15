import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  forwardRef,
  FunctionComponent,
} from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { CheckIcon } from "src/icons";

export type FilterableSelectorOption = {
  value: string;
  label: string;
};

type StyleOptions = {
  border?: boolean;
  textSize?: "text-xs" | "text-sm";
  paddingX?: number;
  paddingY?: number;
  disableFocusStyles?: boolean;
};

const defaultStyleOptions: StyleOptions = {
  border: true,
  textSize: "text-sm",
  paddingX: 2,
  paddingY: 2,
  disableFocusStyles: false,
};

type FilterableSelectorProps = {
  options: FilterableSelectorOption[];
  selected: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  styleOptions?: StyleOptions;
  tabIndex?: number;
};

type FilteredOptions = {
  matching: FilterableSelectorOption[];
  nonMatching: FilterableSelectorOption[];
  all: FilterableSelectorOption[];
};

export const FilterableSelector = forwardRef<
  HTMLInputElement,
  FilterableSelectorProps
>(function FilterableSelector(
  {
    options,
    selected,
    onChange,
    placeholder = "",
    styleOptions = {},
    tabIndex = 0,
  },
  ref,
) {
  const effectiveStyleOptions = useMemo(
    () => ({ ...defaultStyleOptions, ...styleOptions }),
    [styleOptions],
  ) as Required<StyleOptions>;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === selected),
    [options, selected],
  );

  const [open, _setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [filteredOptions, setFilteredOptions] = useState<FilteredOptions>(() =>
    filterOptions(options, ""),
  );

  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      _setOpen((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (next && !prev) {
          setActiveIndex(-1);
        }
        return next;
      });
    },
    [],
  );

  const commit = useCallback(
    (option: FilterableSelectorOption) => {
      onChange(option.value);
      setOpen(false);
    },
    [onChange, setOpen],
  );

  const handleInputChange = useCallback(
    (value: string) => {
      const filtered = filterOptions(options, value);
      setFilteredOptions(filtered);
      setActiveIndex(value.trim() && filtered.matching.length > 0 ? 0 : -1);
      if (!open) {
        setOpen(true);
      }
    },
    [open, setOpen, options],
  );

  const handleInputBlur = useCallback(() => {
    if (activeIndex >= 0) {
      const option = filteredOptions.all[activeIndex];
      if (option && option.value !== selected) {
        onChange(option.value);
      }
    }
  }, [activeIndex, filteredOptions.all, selected, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (LIST_NAVIGATION_KEYS.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (!open) {
          setOpen(true);
        }
        if (filteredOptions.all.length > 0) {
          setActiveIndex(
            (prev) =>
              calculateNextListIndex(e.key, prev, filteredOptions.all.length) ??
              prev,
          );
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else if (filteredOptions.all.length > 0 && activeIndex >= 0) {
          commit(filteredOptions.all[activeIndex]);
        } else {
          setOpen(false);
          setFilteredOptions(filterOptions(options, ""));
        }
        return;
      }

      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        return;
      }

      if (e.key === "Tab") {
        if (open && filteredOptions.all.length > 0 && activeIndex >= 0) {
          commit(filteredOptions.all[activeIndex]);
        }
        setOpen(false);
      }
    },
    [open, filteredOptions.all, setOpen, activeIndex, commit, options],
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <SearchBox
          key={selected ?? ""}
          ref={ref}
          initialLabel={selectedOption?.label ?? ""}
          placeholder={placeholder}
          tabIndex={tabIndex}
          effectiveStyleOptions={effectiveStyleOptions}
          onFocus={() => setOpen(true)}
          onBlur={handleInputBlur}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          className={`bg-white min-w-[180px] border ${effectiveStyleOptions.textSize} rounded-md shadow-md z-50 mt-1 p-1`}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={() => setOpen(false)}
          onPointerDownOutside={() => setOpen(false)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <OptionsList
            filteredOptions={filteredOptions}
            activeIndex={activeIndex}
            selected={selected}
            onActiveIndexChange={setActiveIndex}
            onSelect={commit}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});

function filterOptions(
  options: FilterableSelectorOption[],
  query: string,
): FilteredOptions {
  if (!query.trim()) {
    return { matching: options, nonMatching: [], all: options };
  }
  const lowerQuery = query.toLowerCase();
  const matching: FilterableSelectorOption[] = [];
  const nonMatching: FilterableSelectorOption[] = [];
  for (const opt of options) {
    if (opt.label.toLowerCase().includes(lowerQuery)) {
      matching.push(opt);
    } else {
      nonMatching.push(opt);
    }
  }
  return { matching, nonMatching, all: [...matching, ...nonMatching] };
}

type SearchBoxProps = {
  initialLabel: string;
  placeholder: string;
  tabIndex: number;
  effectiveStyleOptions: Required<StyleOptions>;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  function SearchBox(
    {
      initialLabel,
      placeholder,
      tabIndex,
      effectiveStyleOptions,
      onFocus,
      onBlur,
      onChange,
      onKeyDown,
    },
    ref,
  ) {
    const [inputValue, setInputValue] = useState(initialLabel);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        onChange(value);
      },
      [onChange],
    );

    const handleBlur = useCallback(() => {
      onBlur();
      setInputValue(initialLabel);
    }, [onBlur, initialLabel]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          onChange(inputValue);
          setInputValue(initialLabel);
        }
        onKeyDown(e);
      },
      [onChange, inputValue, onKeyDown, initialLabel],
    );

    const inputStyles = useMemo(() => {
      return clsx(
        "w-full h-full text-gray-700 bg-transparent",
        "outline-none focus:outline-none focus-visible:outline-none",
        "focus:border-transparent",
        !effectiveStyleOptions.disableFocusStyles &&
          "focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10",
        "border rounded-sm",
        effectiveStyleOptions.border ? "border-gray-300" : "border-transparent",
        `px-${effectiveStyleOptions.paddingX} py-${effectiveStyleOptions.paddingY}`,
        effectiveStyleOptions.textSize,
      );
    }, [effectiveStyleOptions]);

    return (
      <div className="relative w-full h-full">
        <input
          ref={ref}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          tabIndex={tabIndex}
          className={inputStyles}
        />
      </div>
    );
  },
);

const PAGE_SIZE = 5;

const LIST_NAVIGATION_KEYS = [
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
];

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

type OptionsListProps = {
  filteredOptions: FilteredOptions;
  activeIndex: number;
  selected: string | null;
  onActiveIndexChange: (index: number) => void;
  onSelect: (option: FilterableSelectorOption) => void;
};

const OptionsList: FunctionComponent<OptionsListProps> = ({
  filteredOptions,
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

      const hasDivider =
        filteredOptions.matching.length > 0 &&
        filteredOptions.nonMatching.length > 0;
      const childIndex =
        hasDivider && activeIndex >= filteredOptions.matching.length
          ? activeIndex + 1
          : activeIndex;
      const activeItem = listRef.current.children[childIndex] as HTMLElement;
      activeItem?.scrollIntoView({ block: "nearest" });
    },
    [
      activeIndex,
      filteredOptions.matching.length,
      filteredOptions.nonMatching.length,
    ],
  );

  const preventFocusOnListItem = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <ul
      ref={listRef}
      tabIndex={-1}
      role="listbox"
      className="outline-none max-h-56 overflow-auto"
    >
      {filteredOptions.matching.map((option, index) => (
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
      {filteredOptions.nonMatching.length > 0 &&
        filteredOptions.matching.length > 0 && (
          <li className="border-t border-gray-200 my-1" aria-hidden="true" />
        )}
      {filteredOptions.nonMatching.map((option, index) => {
        const globalIndex = filteredOptions.matching.length + index;
        return (
          <Option
            key={option.value}
            option={option}
            index={globalIndex}
            isActive={globalIndex === activeIndex}
            isSelected={option.value === selected}
            onMouseEnter={onActiveIndexChange}
            onMouseDown={preventFocusOnListItem}
            onClick={onSelect}
          />
        );
      })}
    </ul>
  );
};

type OptionProps = {
  option: FilterableSelectorOption;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onMouseEnter: (index: number) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (option: FilterableSelectorOption) => void;
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
