import { useState, useRef, KeyboardEventHandler } from "react";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { InlineField } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { TriStateCheckbox } from "src/components/form/Checkbox";
import { RingSpinner } from "src/components/ring-spinner";
import * as P from "@radix-ui/react-popover";
import {
  StyledPopoverArrow,
  StyledPopoverContent,
} from "src/components/elements";
import { MultipleValuesIcon } from "src/icons";
import {
  EditableField,
  formatValue,
  formatEmptyBucket,
  QuantityStatsBaseFields,
  SortableValuesList,
} from "./multi-value-row";
import {
  PropertyStats,
  getDistinctBucketCount,
  getEmptyBucket,
} from "./summary-stats";
import {
  type PropertyStats as DetailedPropertyStats,
  getEmptyBucket as getDetailedEmptyBucket,
} from "./stats";
import { BatchEditPropertyConfig } from "./batch-edit-property-config";
import { AssetId } from "src/hydraulic-model";
import {
  type Curves,
  type CurveType,
  type Patterns,
  type PatternType,
  type LabelManager,
} from "@epanet-js/hydraulic-model";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
import {
  PaywallLockButton,
  PaywallOverlay,
  useFeatureLock,
} from "src/components/form/paywall";

const useSummaryPrimitives = (propertyStats: PropertyStats) => {
  const distinctBuckets = getDistinctBucketCount(propertyStats);
  const emptyBucket = getEmptyBucket(propertyStats);
  const isMixed = distinctBuckets > 1;
  const singleValue = propertyStats.singleValue;
  const distinctValues =
    "distinctValues" in propertyStats ? propertyStats.distinctValues : [];
  const hasOnlyEmpty =
    !isMixed && propertyStats.distinctCount === 0 && !!emptyBucket;
  const decimals =
    propertyStats.type === "quantity" ? propertyStats.decimals : undefined;
  const isInteger =
    propertyStats.type === "quantity" ? propertyStats.isInteger : undefined;

  return {
    distinctBuckets,
    emptyBucket,
    isMixed,
    singleValue,
    distinctValues,
    hasOnlyEmpty,
    decimals,
    isInteger,
  };
};

export const LazyStatsPopoverButton = ({
  label,
  property,
  loadDetails,
  onSelectAssets,
}: {
  label: string;
  property: string;
  loadDetails: () =>
    | DetailedPropertyStats
    | null
    | Promise<DetailedPropertyStats | null>;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [details, setDetails] = useState<DetailedPropertyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef(0);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    const token = ++requestRef.current;

    if (!open) {
      setDetails(null);
      setIsLoading(false);
      return;
    }

    const result = loadDetails();
    if (result instanceof Promise) {
      setDetails(null);
      setIsLoading(true);
      result.then(
        (resolved) => {
          if (requestRef.current !== token) return;
          setDetails(resolved);
          setIsLoading(false);
        },
        () => {
          if (requestRef.current !== token) return;
          setIsLoading(false);
        },
      );
    } else {
      setDetails(result);
      setIsLoading(false);
    }
  };

  const handleContentKeyDown: KeyboardEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.code === "Escape" || event.code === "Enter") {
      event.stopPropagation();
      handleOpenChange(false);
    }
  };

  return (
    <P.Root open={isOpen} onOpenChange={handleOpenChange}>
      <P.Trigger
        aria-label={`Stats for: ${label}`}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-xs text-subtle hover:text-default hover:bg-base-hover"
      >
        <MultipleValuesIcon />
      </P.Trigger>
      <P.Portal>
        <StyledPopoverContent onKeyDown={handleContentKeyDown} align="end">
          <StyledPopoverArrow />
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <RingSpinner />
            </div>
          ) : (
            details && (
              <>
                {details.type === "quantity" && (
                  <QuantityStatsBaseFields quantityStats={details} />
                )}
                <SortableValuesList
                  values={details.values}
                  decimals={
                    details.type === "quantity" ? details.decimals : undefined
                  }
                  isInteger={
                    details.type === "quantity" ? details.isInteger : undefined
                  }
                  type={details.type}
                  onSelectAssets={
                    onSelectAssets
                      ? (ids) => onSelectAssets(ids, property)
                      : undefined
                  }
                  emptyBucket={getDetailedEmptyBucket(details)}
                />
              </>
            )
          )}
        </StyledPopoverContent>
      </P.Portal>
    </P.Root>
  );
};

type SummaryValueRowProps = {
  propertyStats: PropertyStats;
  config: BatchEditPropertyConfig;
  onPropertyChange: (
    modelProperty: ChangeableProperty,
    value: number | string | boolean | null | undefined,
  ) => void;
  readonly?: boolean;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
  onRequestDetails?: (
    property: string,
  ) => DetailedPropertyStats | null | Promise<DetailedPropertyStats | null>;
  curves?: Curves;
  patterns?: Patterns;
  labelManager?: LabelManager;
  onOpenLibrary?: (
    library: "curves" | "patterns" | "pumps",
    filterByType?: CurveType | PatternType,
  ) => void;
};

const StatsButton = ({
  label,
  property,
  isMixed,
  onRequestDetails,
  onSelectAssets,
}: {
  label: string;
  property: string;
  isMixed: boolean;
  onRequestDetails?: (
    property: string,
  ) => DetailedPropertyStats | null | Promise<DetailedPropertyStats | null>;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
}) => {
  if (!isMixed || !onRequestDetails) {
    return <div className="shrink-0 w-7" />;
  }
  return (
    <LazyStatsPopoverButton
      label={label}
      property={property}
      loadDetails={() => onRequestDetails(property)}
      onSelectAssets={onSelectAssets}
    />
  );
};

export function SummaryValueRow({
  propertyStats,
  config,
  onPropertyChange,
  readonly = false,
  onSelectAssets,
  onRequestDetails,
  curves,
  patterns,
  labelManager,
  onOpenLibrary,
}: SummaryValueRowProps) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const {
    distinctBuckets,
    emptyBucket,
    isMixed,
    singleValue,
    distinctValues,
    hasOnlyEmpty,
    decimals,
    isInteger,
  } = useSummaryPrimitives(propertyStats);

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
        <StatsButton
          label={label}
          property={propertyStats.property}
          isMixed={isMixed}
          onRequestDetails={onRequestDetails}
          onSelectAssets={onSelectAssets}
        />
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

export function ReadOnlySummaryValueRow({
  propertyStats,
  onSelectAssets,
  onRequestDetails,
}: {
  propertyStats: PropertyStats;
  onSelectAssets?: (assetIds: AssetId[], property: string) => void;
  onRequestDetails?: (
    property: string,
  ) => DetailedPropertyStats | null | Promise<DetailedPropertyStats | null>;
}) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const label =
    propertyStats.type === "quantity" && propertyStats.unit
      ? `${translate(propertyStats.property)} (${translateUnit(propertyStats.unit)})`
      : translate(propertyStats.property);

  const { emptyBucket, isMixed, singleValue, hasOnlyEmpty, decimals } =
    useSummaryPrimitives(propertyStats);

  const statsButton = (
    <StatsButton
      label={label}
      property={propertyStats.property}
      isMixed={isMixed}
      onRequestDetails={onRequestDetails}
      onSelectAssets={onSelectAssets}
    />
  );

  if (propertyStats.type === "boolean") {
    const isChecked = !isMixed && singleValue === "yes";

    return (
      <InlineField name={label} labelSize="md">
        <div className="flex items-center gap-1">
          {statsButton}
          <div className="p-2 flex items-center h-[38px]">
            <TriStateCheckbox
              checked={isChecked}
              indeterminate={isMixed}
              disabled
              ariaLabel={label}
              onChange={() => {}}
            />
          </div>
        </div>
      </InlineField>
    );
  }

  const displayValue = isMixed
    ? null
    : hasOnlyEmpty && emptyBucket
      ? formatEmptyBucket(emptyBucket, translate, decimals)
      : formatValue(singleValue ?? undefined, translate, decimals);

  return (
    <InlineField name={label} labelSize="md">
      <div className="flex items-center gap-1">
        {statsButton}
        <div className="flex-1 min-w-0">
          {isMixed ? (
            <TextField padding="md" className="italic text-subtle">
              {getDistinctBucketCount(propertyStats)}{" "}
              {translate("values").toLowerCase()}
            </TextField>
          ) : (
            <TextField
              padding="md"
              className={hasOnlyEmpty ? "italic text-subtle" : ""}
            >
              {displayValue}
            </TextField>
          )}
        </div>
      </div>
    </InlineField>
  );
}
