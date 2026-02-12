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
import { pluralize } from "src/lib/utils";

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
        <div className="p-2 flex items-center h-[38px]">
          <TriStateCheckbox
            checked={isChecked}
            indeterminate={hasMultipleValues}
            disabled
            ariaLabel={label}
            onChange={() => {}}
          />
        </div>
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
            className="text-left text-sm p-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-sm hover:bg-gray-200 focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-purple-500 aria-expanded:ring-1 aria-expanded:ring-purple-500 w-full flex items-center gap-x-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600 tabular-nums"
          >
            <MultipleValuesIcon />
            {pluralize(translate, "value", propertyStats.values.size)}
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
