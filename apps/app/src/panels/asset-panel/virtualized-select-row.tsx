import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { triggerStylesFor } from "@epanet-js/ui-kit";
import { InlineField } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import {
  VirtualizedOptionList,
  type VirtualizedOption,
} from "src/components/form/virtualized-option-list";
import { ChevronDownIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import type { PropertyComparison } from "src/hooks/use-asset-comparison";

const triggerStyles = triggerStylesFor({
  border: true,
  textSize: "text-size-base",
  paddingY: 2,
});

export const VirtualizedSelectRow = <P extends string>({
  name,
  selected,
  options,
  placeholder,
  clearLabel,
  comparison,
  onChange,
  readOnly = false,
}: {
  name: P;
  selected: number | null;
  options: VirtualizedOption<number>[];
  placeholder: string;
  clearLabel?: string;
  comparison?: PropertyComparison;
  onChange?: (
    name: P,
    newValue: number | null,
    oldValue: number | null,
  ) => void;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const label = translate(name);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selected) ?? null,
    [options, selected],
  );

  const baseDisplayValue = comparison?.hasChanged
    ? comparison.baseValue != null
      ? (options.find((option) => option.value === comparison.baseValue)
          ?.label ?? String(comparison.baseValue))
      : (clearLabel ?? `(${translate("none").toLocaleLowerCase()})`)
    : undefined;

  const handleCommit = (value: number | null) => {
    setIsOpen(false);
    if (value !== selected) onChange?.(name, value, selected);
  };

  return (
    <InlineField
      name={label}
      labelSize="md"
      hasChanged={comparison?.hasChanged}
      baseDisplayValue={baseDisplayValue}
    >
      {readOnly ? (
        <TextField padding="md">{selectedOption?.label ?? ""}</TextField>
      ) : (
        <div className="w-full">
          <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                role="combobox"
                aria-label={label}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className={triggerStyles}
              >
                <div
                  className={clsx(
                    "text-nowrap overflow-hidden text-ellipsis w-full text-left",
                    !selectedOption && "italic text-subtle",
                  )}
                >
                  {selectedOption ? selectedOption.label : placeholder}
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
                collisionPadding={8}
                className="bg-popover min-w-(--radix-popover-trigger-width) max-h-(--radix-popover-content-available-height) border text-size-base rounded-md shadow-md z-50 mt-1 overflow-hidden flex flex-col"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <VirtualizedOptionList<number>
                  label={label}
                  options={options}
                  selected={selected}
                  clearLabel={clearLabel}
                  onCommit={handleCommit}
                  onClose={() => setIsOpen(false)}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      )}
    </InlineField>
  );
};
