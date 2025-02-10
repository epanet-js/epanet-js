import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import * as Select from "@radix-ui/react-select";
import { KeyboardEventHandler, useMemo, useState } from "react";

export const Selector = <T extends string>({
  options,
  selected,
  onChange,
  ariaLabel,
  tabIndex = 1,
  styleOptions = { border: true, textSize: "text-sm" },
}: {
  options: { label: string; value: T }[];
  selected: T;
  onChange: (selected: T) => void;
  ariaLabel?: string;
  tabIndex?: number;
  styleOptions?: { border: boolean; textSize: "text-xs" | "text-sm" };
}) => {
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
    return `flex items-center ${styleOptions.border ? "border" : ""} ${styleOptions.textSize} text-gray-700 dark:items-center justify-between w-full min-w-[90px] pr-1 pl-2 pl-min-2 py-2 focus:ring-inset focus:ring-1 focus:ring-purple-500 focus:bg-purple-300/10`;
  }, [styleOptions]);

  const contentStyles = useMemo(() => {
    return `bg-white w-full border ${styleOptions.textSize} rounded-md shadow-md z-50`;
  }, [styleOptions]);

  return (
    <div className="relative group-1">
      <Select.Root
        value={selected}
        open={isOpen}
        onOpenChange={handleOpenChange}
        onValueChange={onChange}
      >
        <Select.Trigger
          aria-label={ariaLabel}
          tabIndex={tabIndex}
          className={triggerStyles}
        >
          <Select.Value />
          <Select.Icon className="px-1">
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            onKeyDown={handleKeyDown}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className={contentStyles}
          >
            <Select.Viewport className="p-1">
              {options.map((option, i) => (
                <Select.Item
                  key={i}
                  value={option.value}
                  className="flex items-center px-2 py-2 cursor-pointer focus:bg-purple-300/40"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
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
