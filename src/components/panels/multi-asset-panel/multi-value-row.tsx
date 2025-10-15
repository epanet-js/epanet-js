import { useState, KeyboardEventHandler } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { Unit } from "src/quantity";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { InlineField } from "src/components/form/fields";
import { TextField } from "../asset-panel/ui-components";
import * as P from "@radix-ui/react-popover";
import { StyledPopoverArrow, StyledPopoverContent } from "../../elements";
import { MultipleValuesIcon } from "src/icons";
import {
  PropertyStats,
  QuantityStatsDeprecated,
} from "../asset-property-stats";
import { pluralize } from "src/lib/utils";
import { JsonValue } from "type-fest";

type MultiValueRowProps = {
  name: string;
  propertyStats: PropertyStats;
  unit?: Unit;
  decimals?: number;
};

export function MultiValueRow({
  name,
  propertyStats,
  unit,
  decimals,
}: MultiValueRowProps) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const [isOpen, setIsOpen] = useState(false);

  const label = unit
    ? `${translate(name)} (${translateUnit(unit)})`
    : translate(name);

  const hasMultipleValues = propertyStats.values.size > 1;
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

  return (
    <InlineField name={label} labelSize="md">
      {hasMultipleValues ? (
        <P.Root open={isOpen} onOpenChange={setIsOpen}>
          <P.Trigger
            aria-label={`Values for: ${label}`}
            onKeyDown={handleTriggerKeyDown}
            className="text-left text-sm p-2 text-gray-700 focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-purple-500 aria-expanded:ring-1 aria-expanded:ring-purple-500 w-full bg-transparent flex items-center gap-x-2 dark:text-white"
          >
            <MultipleValuesIcon />
            {pluralize(translate, "value", propertyStats.values.size)}
          </P.Trigger>
          <P.Portal>
            <StyledPopoverContent onKeyDown={handleContentKeyDown}>
              <StyledPopoverArrow />
              {propertyStats.type === "quantity" && (
                <QuantityStatsDeprecatedFields
                  quantityStats={propertyStats}
                  decimals={decimals}
                />
              )}
              <ValuesList values={propertyStats.values} decimals={decimals} />
            </StyledPopoverContent>
          </P.Portal>
        </P.Root>
      ) : (
        <TextField padding="md">{displayValue}</TextField>
      )}
    </InlineField>
  );
}

const QuantityStatsDeprecatedFields = ({
  quantityStats,
  decimals,
}: {
  quantityStats: QuantityStatsDeprecated;
  decimals?: number;
}) => {
  const translate = useTranslate();
  const [tabIndex, setTabIndex] = useState(-1);
  const handleFocus = () => {
    setTabIndex(0);
  };

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4 pb-4">
      {(["min", "max", "mean", "sum"] as const).map((metric, i) => {
        const label = translate(metric);
        return (
          <div
            key={i}
            className="flex flex-col items-space-between justify-center"
          >
            <span
              role="textbox"
              aria-label={`Key: ${label}`}
              className="pb-1 text-xs text-gray-500 font-bold"
            >
              {label}
            </span>
            <input
              role="textbox"
              aria-label={`Value for: ${label}`}
              className="text-xs font-mono px-2 py-2 bg-gray-100 border-none focus-visible:ring-inset focus-visible:ring-purple-500 focus-visible:bg-purple-300/10"
              readOnly
              tabIndex={tabIndex}
              onFocus={handleFocus}
              value={localizeDecimal(quantityStats[metric], { decimals })}
            />
          </div>
        );
      })}
    </div>
  );
};

const ValuesList = ({
  values,
  decimals,
}: {
  values: Map<JsonValue, number>;
  decimals?: number;
}) => {
  const translate = useTranslate();
  const valueEntries = Array.from(values.entries());

  return (
    <div>
      <div className="pb-2 text-xs text-gray-500 font-bold">
        {translate("values")}
      </div>
      <div className="max-h-32 overflow-y-auto">
        <div className="w-full">
          {valueEntries.map(([value, count], index) => (
            <div
              key={index}
              className="py-2 px-2 flex items-center hover:bg-gray-200 dark:hover:bg-gray-700 gap-x-2 even:bg-gray-100"
            >
              <div
                title={formatValue(value, translate, decimals)}
                className="flex-auto font-mono text-xs truncate"
              >
                {formatValue(value, translate, decimals)}
              </div>
              <div className="text-xs font-mono" title={translate("assets")}>
                ({localizeDecimal(count)})
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const formatValue = (
  value: JsonValue | undefined,
  translate: (key: string) => string,
  decimals?: number,
): string => {
  if (value === undefined) return "";
  if (typeof value === "number") {
    return localizeDecimal(value, { decimals });
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);

  return translate(value);
};
