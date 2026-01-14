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
};
export const triggerStylesFor = (styleOptions: StyleOptions) => {
  const effectiveStyleOptions = { ...defaultStyleOptions, ...styleOptions };
  return clsx(
    "flex items-center gap-x-2 text-gray-700 w-full",
    !effectiveStyleOptions.disableHoverEffects &&
      "focus:justify-between hover:border hover:rounded-sm hover:border-gray-200 hover:justify-between min-w-[90px]",
    "border rounded-sm justify-between",
    { "border-gray-300": effectiveStyleOptions.border },
    { "border-transparent": !effectiveStyleOptions.border },
    `px-${effectiveStyleOptions.paddingX} py-${effectiveStyleOptions.paddingY}`,
    effectiveStyleOptions.textSize,
    "pl-min-2",
    !effectiveStyleOptions.disableHoverEffects &&
      "focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10",
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

type SelectorOption<T extends string> = {
  label: string;
  description?: string;
  value: T;
  disabled?: boolean;
};

type SelectorPropsBase<T extends string> = {
  options: SelectorOption<T>[];
  ariaLabel?: string;
  tabIndex?: number;
  styleOptions?: StyleOptions;
  disableFocusOnClose?: boolean;
  onDropdownInteraction?: () => void;
};

type SelectorPropsNonNullable<T extends string> = SelectorPropsBase<T> & {
  selected: T;
  onChange: (selected: T, oldValue: T) => void;
  nullable?: false;
  placeholder?: never;
};

type SelectorPropsNullable<T extends string> = SelectorPropsBase<T> & {
  selected: T | null;
  onChange: (selected: T | null, oldValue: T | null) => void;
  nullable: true;
  placeholder: string;
};

type SelectorProps<T extends string> =
  | SelectorPropsNonNullable<T>
  | SelectorPropsNullable<T>;

export function Selector<T extends string>(
  props: SelectorPropsNonNullable<T>,
): JSX.Element;

export function Selector<T extends string>(
  props: SelectorPropsNullable<T>,
): JSX.Element;

export function Selector<T extends string>({
  options,
  selected,
  onChange,
  ariaLabel,
  tabIndex = 1,
  disableFocusOnClose = false,
  styleOptions = {},
  nullable = false,
  placeholder,
  onDropdownInteraction,
}: SelectorProps<T>) {
  const effectiveStyleOptions = useMemo(
    () => ({ ...defaultStyleOptions, ...styleOptions }),
    [styleOptions],
  );
  const [isOpen, setOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    onDropdownInteraction?.();
    if (open && options.length <= 1) {
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
    return triggerStylesFor(styleOptions);
  }, [styleOptions]);

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
      (onChange as (selected: T, oldValue: T) => void)(
        newValue as T,
        selected as T,
      );
    }
  };

  return (
    <div className="relative group-1">
      <Select.Root
        value={selected ?? ""}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onValueChange={handleValueChange}
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
              {options.map((option, i) => (
                <Select.Item
                  key={i}
                  value={option.value}
                  disabled={option.disabled}
                  className={clsx([
                    "flex items-center justify-between gap-4 px-2 py-2 focus:bg-purple-300/40",
                    {
                      "cursor-pointer": !option.disabled,
                      "text-gray-400": !!option.disabled,
                    },
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
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
