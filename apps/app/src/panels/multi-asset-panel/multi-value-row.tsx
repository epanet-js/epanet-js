import { useState, KeyboardEventHandler } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { InlineField } from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { Selector } from "src/components/form/selector";
import { SelectorListOption } from "src/components/form/selector-list";
import { TriStateCheckbox } from "src/components/form/Checkbox";
import * as P from "@radix-ui/react-popover";
import {
  StyledPopoverArrow,
  StyledPopoverContent,
} from "src/components/elements";
import {
  MultipleValuesIcon,
  SortAscendingIcon,
  SortDescendingIcon,
} from "src/icons";
import {
  AssetPropertyStats,
  EmptyBucket,
  QuantityStats,
  getDistinctBucketCount,
  getEmptyBucket,
} from "./data";
import { BatchEditPropertyConfig } from "./batch-edit-property-config";
import { AssetId } from "src/hydraulic-model";
import type { Curves, CurveType } from "src/hydraulic-model/curves";
import type { Patterns, PatternType } from "src/hydraulic-model/patterns";
import type { LabelManager } from "src/hydraulic-model/label-manager";
import { JsonValue } from "type-fest";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";

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

  const distinctBuckets = getDistinctBucketCount(propertyStats);
  const emptyBucket = getEmptyBucket(propertyStats);
  const isMixed = distinctBuckets > 1;
  const labelKey =
    "labelKey" in config && config.labelKey
      ? config.labelKey
      : propertyStats.property;
  const label =
    propertyStats.type === "quantity" && propertyStats.unit
      ? `${translate(labelKey)} (${translateUnit(propertyStats.unit)})`
      : translate(labelKey);

  return (
    <InlineField name={label} labelSize="md">
      <div className="flex items-center gap-1">
        {isMixed ? (
          <StatsPopoverButton
            propertyStats={propertyStats}
            label={label}
            onSelectAssets={onSelectAssets}
            emptyBucket={emptyBucket}
          />
        ) : (
          <div className="shrink-0 w-7" />
        )}
        <div className="flex-1 min-w-0">
          <EditableField
            propertyStats={propertyStats}
            config={config}
            isMixed={isMixed}
            distinctBuckets={distinctBuckets}
            emptyBucket={emptyBucket}
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
  emptyBucket,
}: {
  propertyStats: AssetPropertyStats;
  label: string;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
  emptyBucket?: EmptyBucket;
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
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-xs text-subtle hover:text-default hover:bg-base-active dark:hover:text-gray-200 dark:hover:bg-gray-700"
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
            isInteger={
              propertyStats.type === "quantity"
                ? propertyStats.isInteger
                : undefined
            }
            type={propertyStats.type}
            onSelectAssets={
              onSelectAssets
                ? (ids) => onSelectAssets(ids, propertyStats.property)
                : undefined
            }
            emptyBucket={emptyBucket}
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
  distinctBuckets,
  emptyBucket,
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
  distinctBuckets: number;
  emptyBucket?: EmptyBucket;
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

  const isOnlyEmpty =
    !isMixed && propertyStats.values.size === 0 && !!emptyBucket;
  const mixedPlaceholder = isOnlyEmpty
    ? translate(emptyBucket.label)
    : `${distinctBuckets} ${translate("values").toLowerCase()}`;

  if (config.fieldType === "quantity") {
    const stats = propertyStats as QuantityStats;
    const firstValue = stats.values.keys().next().value as number | undefined;
    const displayValue =
      isMixed || firstValue === undefined
        ? ""
        : stats.isInteger
          ? String(firstValue)
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
    const firstKey = propertyStats.values.keys().next().value as
      | string
      | undefined;
    const currentValue =
      isMixed || firstKey === undefined
        ? null
        : firstKey.replace(config.statsPrefix, "");

    const toOption = (value: string): SelectorListOption<string> => ({
      value,
      label: config.useUppercaseLabel
        ? value.toUpperCase()
        : translate(config.statsPrefix + value),
    });

    const options: SelectorListOption<string>[] = !readonly
      ? config.values.map(toOption)
      : currentValue != null
        ? [toOption(currentValue)]
        : [];

    const isClearable = !!config.nullLabelKey;
    const isNullable = isMixed || isClearable;
    const clearLabel = isClearable ? translate(config.nullLabelKey!) : "";
    const categoryPlaceholder = isMixed ? mixedPlaceholder : clearLabel;
    const handleCategoryChange = (newValue: string | null) => {
      if (newValue === null) {
        if (isClearable) {
          onPropertyChange(config.modelProperty, undefined as never);
        }
        return;
      }
      onPropertyChange(config.modelProperty, newValue);
    };

    if (isNullable) {
      return (
        <Selector<string>
          selected={currentValue}
          options={options}
          nullable={true}
          placeholder={categoryPlaceholder}
          clearLabel={isClearable ? clearLabel : undefined}
          ariaLabel={label}
          onChange={handleCategoryChange}
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

    const items: SelectorListOption<string>[] = [];
    if (collection) {
      for (const [id, item] of collection) {
        if (config.filterByType && item.type !== config.filterByType) continue;
        items.push({ label: item.label, value: String(id) });
      }
    }

    // Stats store labels; resolve to ID via labelManager
    const firstLabel = propertyStats.values.keys().next().value as
      | string
      | undefined;
    const resolvedId = firstLabel
      ? labelManager?.getIdByLabel(firstLabel, labelType)
      : undefined;
    const currentId = isMixed || resolvedId == null ? null : String(resolvedId);

    const showLibraryAction = !!config.libraryLabelKey && !!onOpenLibrary;
    const resolvedPlaceholder = isMixed
      ? mixedPlaceholder
      : config.nullLabelKey
        ? translate(config.nullLabelKey)
        : translate("none");

    return (
      <Selector<string>
        selected={currentId}
        options={items}
        nullable={true}
        actionLabel={
          showLibraryAction ? translate(config.libraryLabelKey!) : undefined
        }
        onActionClick={
          showLibraryAction
            ? () => onOpenLibrary(config.library, config.filterByType)
            : undefined
        }
        placeholder={resolvedPlaceholder}
        clearLabel={
          config.nullLabelKey ? translate(config.nullLabelKey) : undefined
        }
        ariaLabel={label}
        onChange={(newValue) => {
          onPropertyChange(
            config.modelProperty,
            newValue === null ? (undefined as never) : Number(newValue),
          );
        }}
        disabled={readonly}
      />
    );
  }

  if (config.fieldType === "openCategory") {
    const options = Array.from(propertyStats.values.keys() as Iterable<string>);
    const currentValue = isMixed ? null : (options[0] ?? null);
    const placeholder = isMixed
      ? mixedPlaceholder
      : config.nullLabelKey
        ? translate(config.nullLabelKey)
        : translate("none");

    return (
      <Selector
        options={options.map((o) => ({ value: o, label: o }))}
        selected={currentValue}
        nullable
        allowNew
        onChange={(newValue) => {
          if (newValue === null) return;
          const normalized = newValue.trim();
          if (!normalized) return;
          const canonical =
            options.find((o) => o.toLowerCase() === normalized.toLowerCase()) ??
            normalized;
          onPropertyChange(config.modelProperty, canonical);
        }}
        placeholder={placeholder}
        ariaLabel={label}
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
  const isInteger = quantityStats.isInteger;
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
              className="pb-1 text-size-small text-subtle font-bold"
            >
              {label}
            </span>
            <input
              role="textbox"
              aria-label={`Value for: ${label}`}
              className="text-size-small font-mono px-2 py-2 bg-base-hover border-none focus-visible:ring-inset focus-visible:ring-accent focus-visible:bg-purple-300/10"
              readOnly
              tabIndex={tabIndex}
              onFocus={handleFocus}
              value={
                isInteger
                  ? String(quantityStats[metric])
                  : localizeDecimal(quantityStats[metric], { decimals })
              }
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
  isInteger,
  type,
  onSelectAssets,
  emptyBucket,
}: {
  values: Map<JsonValue, AssetId[]>;
  decimals?: number;
  isInteger?: boolean;
  type: "quantity" | "category" | "boolean" | "literalCategory";
  onSelectAssets?: (assetIds: AssetId[]) => void;
  emptyBucket?: EmptyBucket;
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
          className="text-size-small text-subtle font-bold hover:text-default dark:hover:text-gray-300 cursor-pointer"
          role="columnheader"
          aria-sort={getAriaSort("value")}
        >
          {translate("values")}
          <SortIndicator column="value" />
        </button>
        <button
          onClick={() => handleSort("count")}
          className="text-size-small text-subtle font-bold hover:text-default dark:hover:text-gray-300 cursor-pointer"
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
            const label = formatValue(
              value,
              translate,
              decimals,
              type,
              isInteger,
            );
            return (
              <div
                key={index}
                className={`py-2 px-2 flex items-center hover:bg-base-active gap-x-2 even:bg-base-hover ${isClickable ? "cursor-pointer" : ""}`}
                role="row"
                onClick={
                  isClickable ? () => onSelectAssets(assetIds) : undefined
                }
              >
                <div
                  title={label}
                  className="flex-auto font-mono text-size-small truncate"
                  role="cell"
                >
                  {label}
                </div>
                <div
                  className="text-size-small font-mono"
                  title={translate("assets")}
                  role="cell"
                >
                  ({localizeDecimal(assetIds.length)})
                </div>
              </div>
            );
          })}
          {emptyBucket && (
            <div
              className={`py-2 px-2 flex items-center hover:bg-base-active gap-x-2 even:bg-base-hover ${isClickable ? "cursor-pointer" : ""}`}
              role="row"
              onClick={
                isClickable ? () => onSelectAssets(emptyBucket.ids) : undefined
              }
            >
              <div
                title={translate(emptyBucket.label)}
                className="flex-auto font-mono text-size-small truncate italic text-subtle"
                role="cell"
              >
                {translate(emptyBucket.label)}
              </div>
              <div
                className="text-size-small font-mono"
                title={translate("assets")}
                role="cell"
              >
                ({localizeDecimal(emptyBucket.ids.length)})
              </div>
            </div>
          )}
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
  isInteger?: boolean,
): string => {
  if (value === undefined) return "";
  if (typeof value === "number") {
    return isInteger ? String(value) : localizeDecimal(value, { decimals });
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return String(value);

  if (type === "link") return value;

  return translate(value);
};
