import { useState, KeyboardEventHandler } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { InlineField } from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { Selector, SelectorOption } from "src/components/form/selector";
import * as P from "@radix-ui/react-popover";
import { StyledPopoverArrow, StyledPopoverContent } from "../../elements";
import { MultipleValuesIcon } from "src/icons";
import { AssetPropertyStats, QuantityStats } from "./data";
import { QuantityStatsBaseFields, SortableValuesList } from "./multi-value-row";
import { BatchEditPropertyConfig } from "./batch-edit-property-config";
import { pluralize } from "src/lib/utils";

type BatchEditableRowProps = {
  propertyStats: AssetPropertyStats;
  config: BatchEditPropertyConfig;
  onPropertyChange: (
    modelProperty: string,
    value: number | string | boolean,
  ) => void;
  readonly?: boolean;
};

export function BatchEditableRow({
  propertyStats,
  config,
  onPropertyChange,
  readonly = false,
}: BatchEditableRowProps) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const isMixed = propertyStats.values.size > 1;
  const label =
    propertyStats.type === "quantity" && propertyStats.unit
      ? `${translate(propertyStats.property)} (${translateUnit(propertyStats.unit)})`
      : translate(propertyStats.property);

  return (
    <InlineField name={label} labelSize="md">
      <div className="flex items-center gap-1">
        {isMixed ? (
          <StatsPopoverButton propertyStats={propertyStats} label={label} />
        ) : (
          <div className="flex-shrink-0 w-7" />
        )}
        <div className="flex-1 min-w-0">
          <EditableField
            propertyStats={propertyStats}
            config={config}
            isMixed={isMixed}
            onPropertyChange={onPropertyChange}
            label={label}
            readonly={readonly}
          />
        </div>
      </div>
    </InlineField>
  );
}

const StatsPopoverButton = ({
  propertyStats,
  label,
}: {
  propertyStats: AssetPropertyStats;
  label: string;
}) => {
  const translate = useTranslate();
  const [isOpen, setIsOpen] = useState(false);

  const handleContentKeyDown: KeyboardEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.code === "Escape" || event.code === "Enter") {
      event.stopPropagation();
      setIsOpen(false);
    }
  };

  return (
    <P.Root open={isOpen} onOpenChange={setIsOpen}>
      <P.Trigger
        aria-label={`Stats for: ${label}`}
        title={pluralize(translate, "value", propertyStats.values.size)}
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
      >
        <MultipleValuesIcon />
      </P.Trigger>
      <P.Portal>
        <StyledPopoverContent onKeyDown={handleContentKeyDown} align="end">
          <StyledPopoverArrow />
          {propertyStats.type === "quantity" && (
            <QuantityStatsBaseFields quantityStats={propertyStats} />
          )}
          <SortableValuesList
            values={propertyStats.values}
            decimals={
              propertyStats.type === "quantity"
                ? propertyStats.decimals
                : undefined
            }
            type={propertyStats.type}
          />
        </StyledPopoverContent>
      </P.Portal>
    </P.Root>
  );
};

const EditableField = ({
  propertyStats,
  config,
  isMixed,
  onPropertyChange,
  label,
  readonly,
}: {
  propertyStats: AssetPropertyStats;
  config: BatchEditPropertyConfig;
  isMixed: boolean;
  onPropertyChange: (
    modelProperty: string,
    value: number | string | boolean,
  ) => void;
  label: string;
  readonly: boolean;
}) => {
  const translate = useTranslate();

  if (config.fieldType === "quantity") {
    const stats = propertyStats as QuantityStats;
    const firstValue = stats.values.keys().next().value as number;
    const displayValue = isMixed
      ? ""
      : localizeDecimal(firstValue, { decimals: stats.decimals });

    return (
      <NumericField
        label={label}
        displayValue={displayValue}
        placeholder={translate("mixedValues")}
        positiveOnly={config.positiveOnly}
        isNullable={config.isNullable}
        disabled={readonly}
        styleOptions={{}}
        onChangeValue={(newValue) => {
          onPropertyChange(config.modelProperty, newValue);
        }}
      />
    );
  }

  if (config.fieldType === "category") {
    const firstKey = propertyStats.values.keys().next().value as string;
    const currentValue = isMixed
      ? null
      : firstKey.replace(config.statsPrefix, "");

    const options: SelectorOption<string>[] = readonly
      ? currentValue != null
        ? [
            {
              label: config.useUppercaseLabel
                ? currentValue.toUpperCase()
                : translate(config.statsPrefix + currentValue),
              value: currentValue,
            },
          ]
        : []
      : config.values.map((v) => ({
          label: config.useUppercaseLabel
            ? v.toUpperCase()
            : translate(config.statsPrefix + v),
          value: v,
        }));

    if (isMixed) {
      return (
        <Selector<string>
          selected={currentValue}
          options={options}
          nullable={true}
          placeholder={translate("mixedValues")}
          ariaLabel={label}
          onChange={(newValue) => {
            if (newValue !== null) {
              onPropertyChange(config.modelProperty, newValue);
            }
          }}
          disabled={readonly}
        />
      );
    }

    return (
      <Selector<string>
        selected={currentValue!}
        options={options}
        ariaLabel={label}
        onChange={(newValue) => {
          onPropertyChange(config.modelProperty, newValue);
        }}
        disabled={readonly}
      />
    );
  }

  // Boolean field (e.g. canOverflow)
  const firstKey = propertyStats.values.keys().next().value as string;
  const currentValue = isMixed ? null : firstKey;

  const booleanOptions: SelectorOption<string>[] = readonly
    ? currentValue != null
      ? [{ label: translate(currentValue), value: currentValue }]
      : []
    : [
        { label: translate("yes"), value: "yes" },
        { label: translate("no"), value: "no" },
      ];

  if (isMixed) {
    return (
      <Selector<string>
        selected={currentValue}
        options={booleanOptions}
        nullable={true}
        placeholder={translate("mixedValues")}
        ariaLabel={label}
        onChange={(newValue) => {
          if (newValue !== null) {
            onPropertyChange(config.modelProperty, newValue === "yes");
          }
        }}
        disabled={readonly}
      />
    );
  }

  return (
    <Selector<string>
      selected={currentValue!}
      options={booleanOptions}
      ariaLabel={label}
      onChange={(newValue) => {
        onPropertyChange(config.modelProperty, newValue === "yes");
      }}
      disabled={readonly}
    />
  );
};
