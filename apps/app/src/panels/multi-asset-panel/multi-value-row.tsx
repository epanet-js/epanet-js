import { useState, useRef, useMemo, KeyboardEventHandler } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { localizeDecimal } from "src/infra/i18n/numbers";
import { InlineField } from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { Selector, SelectorListOption } from "@epanet-js/ui-kit";
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
  PropertyStats,
  EmptyBucket,
  QuantityStats,
  getDistinctBucketCount,
  getEmptyBucket,
} from "./stats";
import {
  BatchEditPropertyConfig,
  isOptionalProperty,
} from "./batch-edit-property-config";
import { AssetId } from "src/hydraulic-model";
import {
  type Curves,
  type CurveType,
  type Patterns,
  type PatternType,
  type LabelManager,
} from "@epanet-js/hydraulic-model";
import { JsonValue } from "type-fest";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
import {
  PaywallLockButton,
  PaywallOverlay,
  useFeatureLock,
} from "src/components/form/paywall";

type MultiValueRowProps = {
  propertyStats: PropertyStats;
  config: BatchEditPropertyConfig;
  onPropertyChange: (
    modelProperty: ChangeableProperty,
    value: number | string | boolean | null | undefined,
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
  const singleValue =
    (propertyStats.values.keys().next().value as number | string | undefined) ??
    null;
  const distinctValues = Array.from(
    propertyStats.values.keys() as Iterable<string>,
  );
  const hasOnlyEmpty =
    !isMixed && propertyStats.values.size === 0 && !!emptyBucket;
  const decimals =
    propertyStats.type === "quantity" ? propertyStats.decimals : undefined;
  const isInteger =
    propertyStats.type === "quantity" ? propertyStats.isInteger : undefined;
  const labelKey =
    "labelKey" in config && config.labelKey
      ? config.labelKey
      : propertyStats.property;
  const label =
    propertyStats.type === "quantity" && propertyStats.unit
      ? `${translate(labelKey)} (${translateUnit(propertyStats.unit)})`
      : translate(labelKey);

  const paywallFeature = config.paywall;
  const { isLocked } = useFeatureLock(paywallFeature);
  const paywall =
    paywallFeature !== undefined && isLocked ? paywallFeature : undefined;

  const editable = (
    <EditableField
      config={config}
      isMixed={isMixed}
      distinctBuckets={distinctBuckets}
      singleValue={singleValue}
      distinctValues={distinctValues}
      hasOnlyEmpty={hasOnlyEmpty}
      emptyLabel={emptyBucket?.label}
      emptyValue={emptyBucket?.value}
      decimals={decimals}
      isInteger={isInteger}
      onPropertyChange={onPropertyChange}
      label={label}
      readonly={readonly}
      curves={curves}
      patterns={patterns}
      labelManager={labelManager}
      onOpenLibrary={onOpenLibrary}
    />
  );

  return (
    <InlineField
      name={label}
      labelSize="md"
      labelAction={
        paywall ? (
          <PaywallLockButton feature={paywall} label={label} />
        ) : undefined
      }
    >
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
          {paywall ? (
            <PaywallOverlay feature={paywall} ariaLabel={label}>
              {editable}
            </PaywallOverlay>
          ) : (
            editable
          )}
        </div>
      </div>
    </InlineField>
  );
}

export const StatsPopoverButton = ({
  propertyStats,
  label,
  onSelectAssets,
  emptyBucket,
}: {
  propertyStats: PropertyStats;
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
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-xs text-subtle hover:text-default hover:bg-base-hover"
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

export const EditableField = ({
  config,
  isMixed,
  distinctBuckets,
  singleValue,
  distinctValues,
  hasOnlyEmpty,
  emptyLabel,
  emptyValue,
  decimals,
  isInteger,
  onPropertyChange,
  label,
  readonly,
  curves,
  patterns,
  labelManager,
  onOpenLibrary,
}: {
  config: BatchEditPropertyConfig;
  isMixed: boolean;
  distinctBuckets: number;
  singleValue: number | string | null;
  distinctValues: string[];
  hasOnlyEmpty: boolean;
  emptyLabel?: string;
  emptyValue?: number | null;
  decimals?: number;
  isInteger?: boolean;
  onPropertyChange: (
    modelProperty: ChangeableProperty,
    value: number | string | boolean | null | undefined,
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
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");

  const mixedPlaceholder = hasOnlyEmpty
    ? translate(emptyLabel!)
    : `${distinctBuckets} ${translate("values").toLowerCase()}`;

  if (config.fieldType === "quantity") {
    const firstValue =
      typeof singleValue === "number" ? singleValue : undefined;
    const displayValue =
      isMixed || firstValue === undefined
        ? ""
        : isInteger
          ? String(firstValue)
          : localizeDecimal(firstValue, { decimals });

    const isRequired = !isOptionalProperty(
      config.modelProperty,
      allowsNullValues,
    );
    const commitInvalidValues = !!config.hasModelValidation && allowsNullValues;
    const quantityPlaceholder = !hasOnlyEmpty
      ? mixedPlaceholder
      : emptyValue != null
        ? localizeDecimal(emptyValue, { decimals })
        : "";

    return (
      <NumericField
        label={label}
        displayValue={displayValue}
        placeholder={quantityPlaceholder}
        isRequired={isRequired && !isMixed}
        commitInvalidValues={commitInvalidValues}
        validate={config.validate}
        disabled={readonly}
        styleOptions={{}}
        onChangeValue={(newValue, isEmpty) => {
          if (isEmpty) {
            if (!isRequired) {
              onPropertyChange(config.modelProperty, undefined);
            } else if (commitInvalidValues) {
              onPropertyChange(config.modelProperty, null);
            }
            return;
          }
          onPropertyChange(config.modelProperty, newValue);
        }}
      />
    );
  }

  if (config.fieldType === "category") {
    const firstKey = typeof singleValue === "string" ? singleValue : undefined;
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
          onPropertyChange(config.modelProperty, undefined);
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
    const firstLabel =
      typeof singleValue === "string" ? singleValue : undefined;
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
            newValue === null ? undefined : Number(newValue),
          );
        }}
        disabled={readonly}
      />
    );
  }

  if (config.fieldType === "openCategory") {
    const options = distinctValues;
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
        validateNew={config.validateNew}
      />
    );
  }

  // Boolean field (e.g. canOverflow)
  const isChecked = !isMixed && singleValue === "yes";

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
              className="text-size-small font-mono px-2 py-2 bg-base-disabled border-none focus-visible:ring-inset focus-visible:ring-accent focus-visible:bg-purple-300/10"
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

export const formatEmptyBucket = (
  emptyBucket: { label: string; value?: number | null },
  translate: (key: string) => string,
  decimals?: number,
): string =>
  emptyBucket.value != null
    ? `${translate(emptyBucket.label)} (${localizeDecimal(emptyBucket.value, {
        decimals,
      })})`
    : translate(emptyBucket.label);

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

  const emptyBucketLabel = emptyBucket
    ? formatEmptyBucket(emptyBucket, translate, decimals)
    : "";

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

  const sortedRows = useMemo(() => {
    const entries = Array.from(values.entries()).sort(
      ([a, idsA], [b, idsB]) => {
        const multiplier = sortDirection === "asc" ? 1 : -1;
        if (sortColumn === "value") {
          if (type === "quantity") {
            return ((a as number) - (b as number)) * multiplier;
          }
          return String(a).localeCompare(String(b)) * multiplier;
        }
        return (idsA.length - idsB.length) * multiplier;
      },
    );

    const result: {
      value: JsonValue | null;
      assetIds: AssetId[];
      isEmpty: boolean;
    }[] = entries.map(([value, assetIds]) => ({
      value,
      assetIds,
      isEmpty: false,
    }));
    if (emptyBucket) {
      result.push({ value: null, assetIds: emptyBucket.ids, isEmpty: true });
    }
    return result;
  }, [values, sortColumn, sortDirection, type, emptyBucket]);

  const isClickable = !!onSelectAssets;

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 34,
    overscan: 8,
  });

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
      <div ref={parentRef} className="max-h-32 overflow-y-auto" role="rowgroup">
        <div
          className="w-full relative"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = sortedRows[virtualRow.index];
            const label = row.isEmpty
              ? emptyBucketLabel
              : formatValue(row.value, translate, decimals, type, isInteger);
            const striped = virtualRow.index % 2 === 1;
            return (
              <div
                key={virtualRow.index}
                className={`absolute top-0 left-0 w-full py-2 px-2 flex items-center hover:bg-base-hover gap-x-2 ${striped ? "bg-panel" : ""} ${isClickable ? "cursor-pointer" : ""}`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                role="row"
                onClick={
                  isClickable ? () => onSelectAssets(row.assetIds) : undefined
                }
              >
                <div
                  title={label}
                  className={`flex-auto font-mono text-size-small truncate ${row.isEmpty ? "italic text-subtle" : ""}`}
                  role="cell"
                >
                  {label}
                </div>
                <div
                  className="text-size-small font-mono"
                  title={translate("assets")}
                  role="cell"
                >
                  ({localizeDecimal(row.assetIds.length)})
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
