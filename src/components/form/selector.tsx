import * as Select from "@radix-ui/react-select";
import clsx from "clsx";
import { CheckIcon, ChevronDownIcon } from "src/icons";
import React from "react";
import { KeyboardEventHandler, useMemo, useState } from "react";

const defaultStyleOptions: StyleOptions = {
  border: true,
  textSize: "text-sm",
  paddingX: 2,
  paddingY: 2,
};

type StyleOptions = {
  border?: boolean;
  textSize?: "text-xs" | "text-sm";
  paddingX?: number;
  paddingY?: number;
  disableHoverEffects?: boolean;
  variant?: "default" | "warning";
};
export const triggerStylesFor = (styleOptions: StyleOptions) => {
  const effectiveStyleOptions = { ...defaultStyleOptions, ...styleOptions };
  const isWarning = effectiveStyleOptions.variant === "warning";
  return clsx(
    "flex items-center gap-x-2 text-gray-700 bg-white dark:bg-gray-900 w-full",
    !effectiveStyleOptions.disableHoverEffects &&
      "focus:justify-between hover:border hover:rounded-sm hover:border-gray-200 hover:justify-between min-w-[90px]",
    "border rounded-sm justify-between",
    isWarning
      ? "border-orange-500 dark:border-orange-700"
      : {
          "border-gray-300": effectiveStyleOptions.border,
          "border-transparent": !effectiveStyleOptions.border,
        },
    `px-${effectiveStyleOptions.paddingX} py-${effectiveStyleOptions.paddingY}`,
    effectiveStyleOptions.textSize,
    "pl-min-2",
    !effectiveStyleOptions.disableHoverEffects &&
      (isWarning
        ? "focus:ring-inset focus:ring-1 focus:ring-orange-500 dark:focus:ring-orange-700"
        : "focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10"),
  );
};

export const SelectorLikeButton = React.forwardRef<
  HTMLButtonElement, // Specify the type of the ref being forwarded
  {
    children: React.ReactNode;
    ariaLabel?: string;
    tabIndex?: number;
    styleOptions?: StyleOptions;
  }
>(
  (
    { children, ariaLabel, tabIndex = 1, styleOptions = {}, ...props },
    forwardedRef,
  ) => {
    const triggerStyles = useMemo(() => {
      return triggerStylesFor(styleOptions);
    }, [styleOptions]);

    return (
      <button
        ref={forwardedRef} // Forward the ref here
        aria-label={ariaLabel}
        tabIndex={tabIndex}
        className={triggerStyles}
        {...props} // Spread all other props received from Popover.Trigger
      >
        <div className="text-nowrap overflow-hidden text-ellipsis">
          {children}
        </div>
        <div className="px-1">
          <ChevronDownIcon />
        </div>
      </button>
    );
  },
);

export type SelectorOption<T extends string | number> = {
  label: string;
  description?: string;
  value: T;
  disabled?: boolean;
};

type SelectorOptionsInput<T extends string | number> =
  | SelectorOption<T>[]
  | SelectorOption<T>[][];

const isGrouped = <T extends string | number>(
  options: SelectorOptionsInput<T>,
): options is SelectorOption<T>[][] =>
  options.length > 0 && Array.isArray(options[0]);

const normalizeGroups = <T extends string | number>(
  options: SelectorOptionsInput<T>,
): SelectorOption<T>[][] => (isGrouped(options) ? options : [options]);

const flattenOptions = <T extends string | number>(
  options: SelectorOptionsInput<T>,
): SelectorOption<T>[] => (isGrouped(options) ? options.flat() : options);

type SelectorPropsBase<T extends string | number> = {
  options: SelectorOptionsInput<T>;
  ariaLabel?: string;
  tabIndex?: number;
  styleOptions?: StyleOptions;
  listClassName?: string;
  disableFocusOnClose?: boolean;
  onDropdownInteraction?: () => void;
  disabled?: boolean;
};

type SelectorPropsNonNullable<T extends string | number> =
  SelectorPropsBase<T> & {
    selected: T;
    onChange: (selected: T, oldValue: T) => void;
    nullable?: false;
    placeholder?: never;
  };

type SelectorPropsNullable<T extends string | number> = SelectorPropsBase<T> & {
  selected: T | null;
  onChange: (selected: T | null, oldValue: T | null) => void;
  nullable: true;
  placeholder: string;
};

type SelectorProps<T extends string | number> =
  | SelectorPropsNonNullable<T>
  | SelectorPropsNullable<T>;

export function Selector<T extends string | number>(
  props: SelectorPropsNonNullable<T>,
): JSX.Element;

export function Selector<T extends string | number>(
  props: SelectorPropsNullable<T>,
): JSX.Element;

export function Selector<T extends string | number>({
  options,
  selected,
  onChange,
  ariaLabel,
  tabIndex = 1,
  disableFocusOnClose = false,
  styleOptions = {},
  listClassName,
  nullable = false,
  placeholder,
  onDropdownInteraction,
  disabled = false,
}: SelectorProps<T>) {
  const allOptions = useMemo(() => flattenOptions(options), [options]);
  const optionGroups = useMemo(() => normalizeGroups(options), [options]);

  const effectiveStyleOptions = useMemo(
    () => ({ ...defaultStyleOptions, ...styleOptions }),
    [styleOptions],
  );
  const [isOpen, setOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    onDropdownInteraction?.();
    if (open && allOptions.length <= 1) {
      return;
    }
    setOpen(open);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.code === "Escape" || event.code === "Enter") {
      event.stopPropagation();
      setOpen(false);
    }
  };

  const triggerStyles = useMemo(() => {
    return clsx(
      triggerStylesFor(styleOptions),
      disabled && "opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-800",
    );
  }, [styleOptions, disabled]);

  const contentStyles = useMemo(() => {
    return `bg-white w-full border ${effectiveStyleOptions.textSize} rounded-md shadow-md z-50`;
  }, [effectiveStyleOptions.textSize]);

  const handleValueChange = (newValue: string) => {
    if (nullable && newValue === "") {
      (onChange as (selected: T | null, oldValue: T | null) => void)(
        null,
        selected,
      );
    } else {
      const typedValue = allOptions.find((o) => String(o.value) === newValue)
        ?.value as T;
      (onChange as (selected: T, oldValue: T) => void)(
        typedValue,
        selected as T,
      );
    }
  };

  return (
    <div className="relative group-1">
      <Select.Root
        value={selected != null ? String(selected) : ""}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <Select.Trigger
          aria-label={ariaLabel}
          tabIndex={tabIndex}
          className={triggerStyles}
        >
          <div className="text-nowrap overflow-hidden text-ellipsis">
            <Select.Value placeholder={nullable ? placeholder : undefined} />
          </div>
          <Select.Icon className="px-1">
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            onKeyDown={handleKeyDown}
            onCloseAutoFocus={(e) => disableFocusOnClose && e.preventDefault()}
            className={contentStyles}
          >
            <Select.Viewport className="p-1">
              {optionGroups.map((group, groupIndex) => (
                <Select.Group key={groupIndex}>
                  {groupIndex > 0 && (
                    <Select.Separator className="h-px bg-gray-200 my-1" />
                  )}
                  {group.map((option) => (
                    <Select.Item
                      key={String(option.value)}
                      value={String(option.value)}
                      disabled={option.disabled}
                      className={clsx([
                        "flex items-center justify-between gap-4 px-2 py-2 focus:bg-purple-300/40",
                        {
                          "cursor-pointer": !option.disabled,
                          "text-gray-400": !!option.disabled,
                        },
                        listClassName,
                      ])}
                    >
                      <Select.ItemText>
                        {option.description ? option.description : option.label}
                      </Select.ItemText>
                      <Select.ItemIndicator className="ml-auto">
                        <CheckIcon className="text-purple-700" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Group>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
