import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import * as Select from "@radix-ui/react-select";
import clsx from "clsx";
import { KeyboardEventHandler, useMemo, useState } from "react";

const defaultStyleOptions = {
  border: true,
  textSize: "text-sm",
  paddingX: 2,
  paddingY: 2,
};

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
  }, [effectiveStyleOptions]);

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
};
