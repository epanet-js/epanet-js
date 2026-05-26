import * as Select from "@radix-ui/react-select";
import clsx from "clsx";
import { CheckIcon, ChevronDownIcon } from "src/icons";
import { KeyboardEventHandler, useMemo, useState } from "react";
import { StyleOptions, triggerStylesFor } from "./selector-trigger";

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

const defaultStyleOptions: StyleOptions = {
  border: true,
  textSize: "text-sm",
  paddingX: 2,
  paddingY: 2,
};

type SelectorPropsBase<T extends string | number> = {
  options: SelectorOptionsInput<T>;
  ariaLabel?: string;
  tabIndex?: number;
  styleOptions?: StyleOptions;
  listClassName?: string;
  stickyGroupClassName?: string;
  disableFocusOnClose?: boolean;
  onDropdownInteraction?: () => void;
  disabled?: boolean;
  stickyFirstGroup?: boolean;
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
  stickyGroupClassName,
  nullable = false,
  placeholder,
  onDropdownInteraction,
  disabled = false,
  stickyFirstGroup = false,
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
    const minOptions = stickyFirstGroup ? 1 : 2;
    if (open && allOptions.length < minOptions) {
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
    return triggerStylesFor(styleOptions, { disabled });
  }, [styleOptions, disabled]);

  const contentStyles = useMemo(() => {
    return `bg-white min-w-(--radix-select-trigger-width) border ${effectiveStyleOptions.textSize} rounded-md shadow-md z-50 overflow-hidden`;
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
          <div
            className={clsx(
              "text-nowrap overflow-hidden text-ellipsis w-full text-left",
              selected == null && nullable && "italic text-gray-500",
            )}
          >
            <Select.Value placeholder={nullable ? placeholder : undefined} />
          </div>
          <Select.Icon className="px-1">
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            onKeyDown={handleKeyDown}
            onCloseAutoFocus={(e) => disableFocusOnClose && e.preventDefault()}
            className={contentStyles}
          >
            {stickyFirstGroup && optionGroups.length > 1 && (
              <Select.Group className="p-1 pb-0">
                {optionGroups[0].map((option) => (
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
                      stickyGroupClassName ?? listClassName,
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
                {optionGroups.slice(1).some((g) => g.length > 0) && (
                  <Select.Separator className="h-px bg-gray-200 mt-1" />
                )}
              </Select.Group>
            )}
            <Select.Viewport className="max-h-60 overflow-y-auto scroll-shadows">
              <div className="p-1">
                {(stickyFirstGroup ? optionGroups.slice(1) : optionGroups).map(
                  (group, groupIndex) => (
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
                            {option.description
                              ? option.description
                              : option.label}
                          </Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <CheckIcon className="text-purple-700" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  ),
                )}
              </div>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
