import { useState, KeyboardEventHandler } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { Unit } from "src/quantity";
import { InlineField } from "src/components/form/fields";
import { TextField } from "../asset-panel/ui-components";
import * as P from "@radix-ui/react-popover";
import { StyledPopoverArrow, StyledPopoverContent } from "../../elements";
import { MultipleValuesIcon } from "src/icons";
import { TriStateCheckbox } from "src/components/form/Checkbox";
import { AssetPropertyStats } from "./data";
import {
  QuantityStatsBaseFields,
  SortableValuesList,
  formatValue,
} from "./multi-value-row";

type ReadOnlyMultiValueRowProps = {
  name: string;
  propertyStats: AssetPropertyStats;
  unit?: Unit;
  decimals?: number;
};

export function ReadOnlyMultiValueRow({
  name,
  propertyStats,
  unit,
  decimals,
}: ReadOnlyMultiValueRowProps) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const [isOpen, setIsOpen] = useState(false);

  const label = unit
    ? `${translate(name)} (${translateUnit(unit)})`
    : translate(name);

  const hasMultipleValues = propertyStats.values.size > 1;

  const isBooleanField = propertyStats.type === "boolean";

  const firstValue = propertyStats.values.keys().next().value;

  const displayValue = hasMultipleValues
    ? null
    : formatValue(firstValue, translate, decimals);

  const handleContentKeyDown: KeyboardEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.code === "Escape" || event.code === "Enter") {
      event.stopPropagation();
      setIsOpen(false);
    }
  };

  const handleTriggerKeyDown: KeyboardEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    if (event.code === "Enter" && !isOpen) {
      setIsOpen(true);
      event.stopPropagation();
    }
  };

  if (isBooleanField) {
    const isChecked = !hasMultipleValues && firstValue === "yes";

    return (
      <InlineField name={label} labelSize="md">
        {hasMultipleValues ? (
          <P.Root open={isOpen} onOpenChange={setIsOpen}>
            <P.Trigger
              aria-label={`Values for: ${label}`}
              onKeyDown={handleTriggerKeyDown}
              className="w-full text-left rounded-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-purple-500 aria-expanded:ring-1 aria-expanded:ring-purple-500 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600"
            >
              <div className="flex items-center gap-1">
                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
                  <MultipleValuesIcon />
                </div>
                <div className="p-2 flex items-center h-[38px]">
                  <TriStateCheckbox
                    checked={false}
                    indeterminate
                    disabled
                    ariaLabel={label}
                    onChange={() => {}}
                  />
                </div>
              </div>
            </P.Trigger>
            <P.Portal>
              <StyledPopoverContent
                onKeyDown={handleContentKeyDown}
                align="end"
              >
                <StyledPopoverArrow />
                <SortableValuesList
                  values={propertyStats.values}
                  decimals={undefined}
                  type={propertyStats.type}
                />
              </StyledPopoverContent>
            </P.Portal>
          </P.Root>
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex-shrink-0 w-7" />
            <div className="p-2 flex items-center h-[38px]">
              <TriStateCheckbox
                checked={isChecked}
                indeterminate={false}
                disabled
                ariaLabel={label}
                onChange={() => {}}
              />
            </div>
          </div>
        )}
      </InlineField>
    );
  }

  return (
    <InlineField name={label} labelSize="md">
      {hasMultipleValues ? (
        <P.Root open={isOpen} onOpenChange={setIsOpen}>
          <P.Trigger
            aria-label={`Values for: ${label}`}
            onKeyDown={handleTriggerKeyDown}
            className="w-full text-left rounded-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-purple-500 aria-expanded:ring-1 aria-expanded:ring-purple-500 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600"
          >
            <div className="flex items-center gap-1">
              <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
                <MultipleValuesIcon />
              </div>
              <div className="flex-1 min-w-0">
                <TextField padding="md" className="italic">
                  {propertyStats.values.size}{" "}
                  {translate("values").toLowerCase()}
                </TextField>
              </div>
            </div>
          </P.Trigger>
          <P.Portal>
            <StyledPopoverContent onKeyDown={handleContentKeyDown} align="end">
              <StyledPopoverArrow />
              {propertyStats.type === "quantity" && (
                <QuantityStatsBaseFields quantityStats={propertyStats} />
              )}
              <SortableValuesList
                values={propertyStats.values}
                decimals={decimals}
                type={propertyStats.type}
              />
            </StyledPopoverContent>
          </P.Portal>
        </P.Root>
      ) : (
        <div className="flex items-center gap-1">
          <div className="flex-shrink-0 w-7" />
          <div className="flex-1 min-w-0">
            <TextField padding="md">{displayValue}</TextField>
          </div>
        </div>
      )}
    </InlineField>
  );
}
