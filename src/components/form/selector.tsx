import {
  CheckIcon as DeprecatedCheckIcon,
  ChevronDownIcon as DeprecatedChevronDown,
} from "@radix-ui/react-icons";
import * as Select from "@radix-ui/react-select";
import clsx from "clsx";
import { CheckIcon, ChevronDownIcon } from "src/icons";
import React from "react";
import { KeyboardEventHandler, useMemo, useState } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

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
};
export const triggerStylesFor = (styleOptions: StyleOptions) => {
  const effectiveStyleOptions = { ...defaultStyleOptions, ...styleOptions };
  return clsx(
    "flex items-center gap-x-2 text-gray-700 focus:justify-between hover:border hover:rounded-sm hover:border-gray-200 hover:justify-between w-full min-w-[90px]",
    "border rounded-sm",
    { "border-gray-200 justify-between": effectiveStyleOptions.border },
    { "border-transparent": !effectiveStyleOptions.border },
    `px-${effectiveStyleOptions.paddingX} py-${effectiveStyleOptions.paddingY}`,
    effectiveStyleOptions.textSize,
    "pl-min-2",
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

    const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");

    return (
      <button
        ref={forwardedRef} // Forward the ref here
        aria-label={ariaLabel}
        tabIndex={tabIndex}
        className={triggerStyles}
        {...props} // Spread all other props received from Popover.Trigger
      >
        {children}
        <div className="px-1">
          {isLucideIconsOn ? <ChevronDownIcon /> : <DeprecatedChevronDown />}
        </div>
      </button>
    );
  },
);

export const Selector = <T extends string>({
  options,
  selected,
  onChange,
  ariaLabel,
  tabIndex = 1,
  disableFocusOnClose = false,
  styleOptions = {},
}: {
  options: {
    label: string;
    description?: string;
    value: T;
    disabled?: boolean;
  }[];
  selected: T;
  onChange: (selected: T, oldValue: T) => void;
  ariaLabel?: string;
  tabIndex?: number;
  styleOptions?: {
    border?: boolean;
    textSize?: "text-xs" | "text-sm";
    paddingX?: number;
    paddingY?: number;
  };
  disableFocusOnClose?: boolean;
}) => {
  const effectiveStyleOptions = useMemo(
    () => ({ ...defaultStyleOptions, ...styleOptions }),
    [styleOptions],
  );
  const isLucideIconsOn = useFeatureFlag("FLAG_LUCIDE_ICONS");
  const [isOpen, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
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

  const handleValueChange = (newValue: T) => {
    onChange(newValue, selected);
  };

  const selectedOption = useMemo(() => {
    return options.find((o) => o.value === selected);
  }, [options, selected]);

  return (
    <div className="relative group-1">
      <Select.Root
        value={selected}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onValueChange={handleValueChange}
      >
        <Select.Trigger
          aria-label={ariaLabel}
          tabIndex={tabIndex}
          className={triggerStyles}
        >
          <Select.Value>
            {selectedOption ? selectedOption.label : ""}
          </Select.Value>
          <Select.Icon className="px-1">
            {isLucideIconsOn ? <ChevronDownIcon /> : <DeprecatedChevronDown />}
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
                    {isLucideIconsOn ? (
                      <CheckIcon className="text-purple-700" />
                    ) : (
                      <DeprecatedCheckIcon className="text-purple-700" />
                    )}
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
};
