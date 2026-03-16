import { useState, KeyboardEventHandler } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { InlineField } from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { Selector, SelectorOption } from "src/components/form/selector";
import { TriStateCheckbox } from "src/components/form/Checkbox";
import * as P from "@radix-ui/react-popover";
import { StyledPopoverArrow, StyledPopoverContent } from "../../elements";
import {
  MultipleValuesIcon,
  SortAscendingIcon,
  SortDescendingIcon,
} from "src/icons";
import { AssetPropertyStats, QuantityStats } from "./data";
import { BatchEditPropertyConfig } from "./batch-edit-property-config";
import { AssetId } from "src/hydraulic-model";
import type { Curves, CurveType } from "src/hydraulic-model/curves";
import type { Patterns, PatternType } from "src/hydraulic-model/patterns";
import type { LabelManager } from "src/hydraulic-model/label-manager";
import { JsonValue } from "type-fest";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
import clsx from "clsx";

type MultiValueRowProps = {
  propertyStats: AssetPropertyStats;
  config: BatchEditPropertyConfig;
  onPropertyChange: (
    modelProperty: ChangeableProperty,
    value: number | string | boolean,
  ) => void;
  readonly?: boolean;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
  curves?: Curves;
  patterns?: Patterns;
  labelManager?: LabelManager;
  onOpenLibrary?: (
    library: "curves" | "patterns" | "pumps",
    filterByType?: CurveType | PatternType,
  ) => void;
};

export function MultiValueRow({
  propertyStats,
  config,
  onPropertyChange,
  readonly = false,
  onSelectAssets,
  curves,
  patterns,
  labelManager,
  onOpenLibrary,
}: MultiValueRowProps) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const isMixed = propertyStats.values.size > 1;
  const label =
    propertyStats.type === "quantity" && propertyStats.unit
      ? `${translate(propertyStats.property)} (${translateUnit(propertyStats.unit)})`
      : translate(propertyStats.property);
  const nullLabel =
    "nullLabelKey" in config && config.nullLabelKey
      ? translate(config.nullLabelKey)
      : undefined;

  return (
    <InlineField name={label} labelSize="md">
      <div className="flex items-center gap-1">
        {isMixed ? (
          <StatsPopoverButton
            propertyStats={propertyStats}
            label={label}
            onSelectAssets={onSelectAssets}
            nullLabel={nullLabel}
          />
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
            curves={curves}
            patterns={patterns}
            labelManager={labelManager}
            onOpenLibrary={onOpenLibrary}
          />
        </div>
      </div>
    </InlineField>
  );
}

const StatsPopoverButton = ({
  propertyStats,
  label,
  onSelectAssets,
  nullLabel,
}: {
  propertyStats: AssetPropertyStats;
  label: string;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
  nullLabel?: string;
}) => {
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
            onSelectAssets={
              onSelectAssets
                ? (ids) => onSelectAssets(ids, propertyStats.property)
                : undefined
            }
            nullLabel={nullLabel}
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
  curves,
  patterns,
  labelManager,
  onOpenLibrary,
}: {
  propertyStats: AssetPropertyStats;
  config: BatchEditPropertyConfig;
  isMixed: boolean;
  onPropertyChange: (
    modelProperty: ChangeableProperty,
    value: number | string | boolean,
  ) => void;
  label: string;
  readonly: boolean;
  curves?: Curves;
  patterns?: Patterns;
  labelManager?: LabelManager;
  onOpenLibrary?: (
    library: "curves" | "patterns" | "pumps",
    filterByType?: CurveType | PatternType,
  ) => void;
}) => {
  const translate = useTranslate();

  const mixedPlaceholder = `${propertyStats.values.size} ${translate("values").toLowerCase()}`;

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
        placeholder={mixedPlaceholder}
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
          placeholder={mixedPlaceholder}
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

  if (config.fieldType === "librarySelect") {
    const collection = config.library === "patterns" ? patterns : curves;
    const labelType = config.library === "patterns" ? "pattern" : "curve";
    const LIBRARY_SENTINEL = "-1";

    const itemGroup: SelectorOption<string>[] = [];
    if (collection) {
      for (const [id, item] of collection) {
        if (config.filterByType && item.type !== config.filterByType) continue;
        itemGroup.push({ label: item.label, value: String(id) });
      }
    }

    const options: SelectorOption<string>[][] = [];
    if (config.libraryLabelKey && onOpenLibrary) {
      options.push([
        { label: translate(config.libraryLabelKey), value: LIBRARY_SENTINEL },
      ]);
    }
    options.push(itemGroup);

    // Stats store labels; resolve to ID via labelManager
    const firstLabel = propertyStats.values.keys().next().value as string;
    const resolvedId = labelManager?.getIdByLabel(firstLabel, labelType);
    const currentId = isMixed
      ? null
      : resolvedId != null
        ? String(resolvedId)
        : null;

    return (
      <Selector<string>
        selected={currentId}
        options={options}
        nullable={true}
        stickyFirstGroup={!!config.libraryLabelKey && !!onOpenLibrary}
        stickyGroupClassName="italic"
        placeholder={
          isMixed
            ? mixedPlaceholder
            : config.nullLabelKey
              ? translate(config.nullLabelKey)
              : translate("none")
        }
        ariaLabel={label}
        onChange={(newValue) => {
          if (newValue === LIBRARY_SENTINEL) {
            onOpenLibrary?.(config.library, config.filterByType);
            return;
          }
          onPropertyChange(
            config.modelProperty,
            newValue === null ? (undefined as never) : Number(newValue),
          );
        }}
        disabled={readonly}
      />
    );
  }

  // Boolean field (e.g. canOverflow)
  const firstKey = propertyStats.values.keys().next().value as string;
  const isChecked = !isMixed && firstKey === "yes";

  return (
    <div className="p-2 flex items-center h-[38px]">
      <TriStateCheckbox
        checked={isChecked}
        indeterminate={isMixed}
        disabled={readonly}
        ariaLabel={label}
        onChange={(newChecked) => {
          onPropertyChange(config.modelProperty, newChecked);
        }}
      />
    </div>
  );
};

export const QuantityStatsBaseFields = ({
  quantityStats,
}: {
  quantityStats: QuantityStats;
}) => {
  const decimals = quantityStats.decimals;
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

type SortColumn = "value" | "count";
type SortDirection = "asc" | "desc";

export const SortableValuesList = ({
  values,
  decimals,
  type,
  onSelectAssets,
  nullLabel,
}: {
  values: Map<JsonValue, AssetId[]>;
  decimals?: number;
  type: "quantity" | "category" | "boolean" | "literalCategory";
  onSelectAssets?: (assetIds: AssetId[]) => void;
  nullLabel?: string;
}) => {
  const translate = useTranslate();

  const [sortColumn, setSortColumn] = useState<SortColumn>(
    type === "quantity" ? "value" : "count",
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    type === "quantity" ? "desc" : "asc",
  );

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      const defaultDirection =
        column === "value" && type !== "quantity" ? "asc" : "desc";
      setSortDirection(defaultDirection);
    }
  };

  const valueEntries = Array.from(values.entries()).sort(
    ([a, idsA], [b, idsB]) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (sortColumn === "value") {
        if (type === "quantity") {
          return ((a as number) - (b as number)) * multiplier;
        } else {
          return String(a).localeCompare(String(b)) * multiplier;
        }
      } else {
        return (idsA.length - idsB.length) * multiplier;
      }
    },
  );

  const isClickable = !!onSelectAssets;

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    const isActive = sortColumn === column;
    return (
      <span
        className={`ml-1 inline-flex align-middle ${isActive ? "" : "invisible"}`}
        aria-hidden="true"
      >
        {sortDirection === "asc" ? (
          <SortAscendingIcon size="md" />
        ) : (
          <SortDescendingIcon size="md" />
        )}
      </span>
    );
  };

  const getAriaSort = (column: SortColumn) => {
    if (sortColumn !== column) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  };

  return (
    <div role="table" aria-label={translate("values")}>
      <div className="flex justify-between pb-2" role="row">
        <button
          onClick={() => handleSort("value")}
          className="text-xs text-gray-500 font-bold hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
          role="columnheader"
          aria-sort={getAriaSort("value")}
        >
          {translate("values")}
          <SortIndicator column="value" />
        </button>
        <button
          onClick={() => handleSort("count")}
          className="text-xs text-gray-500 font-bold hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer"
          role="columnheader"
          aria-sort={getAriaSort("count")}
        >
          {translate("count")}
          <SortIndicator column="count" />
        </button>
      </div>
      <div className="max-h-32 overflow-y-auto" role="rowgroup">
        <div className="w-full">
          {valueEntries.map(([value, assetIds], index) => {
            const label = formatValue(value, translate, decimals, type);
            const emptyLabel = nullLabel ?? translate("none");
            return (
              <div
                key={index}
                className={`py-2 px-2 flex items-center hover:bg-gray-200 dark:hover:bg-gray-700 gap-x-2 even:bg-gray-100 ${isClickable ? "cursor-pointer" : ""}`}
                role="row"
                onClick={
                  isClickable ? () => onSelectAssets(assetIds) : undefined
                }
              >
                <div
                  title={label || emptyLabel}
                  className={clsx(
                    "flex-auto font-mono text-xs truncate",
                    !label && "italic text-gray-600",
                  )}
                  role="cell"
                >
                  {label || emptyLabel}
                </div>
                <div
                  className="text-xs font-mono"
                  title={translate("assets")}
                  role="cell"
                >
                  ({localizeDecimal(assetIds.length)})
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const formatValue = (
  value: JsonValue | undefined,
  translate: (key: string) => string,
  decimals?: number,
  type?: string,
): string => {
  if (value === undefined) return "";
  if (typeof value === "number") {
    return localizeDecimal(value, { decimals });
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);

  if (type === "link") return value;

  return translate(value);
};
