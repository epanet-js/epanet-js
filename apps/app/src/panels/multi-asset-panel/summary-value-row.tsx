import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { InlineField } from "src/components/form/fields";
import { TextField } from "src/components/form/text-field";
import { TriStateCheckbox } from "src/components/form/Checkbox";
import {
  EditableField,
  formatValue,
  formatEmptyBucket,
} from "./multi-value-row";
import {
  PropertyStats,
  getDistinctBucketCount,
  getEmptyBucket,
} from "./summary-stats";
import { BatchEditPropertyConfig } from "./batch-edit-property-config";
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

type SummaryValueRowProps = {
  propertyStats: PropertyStats;
  config: BatchEditPropertyConfig;
  onPropertyChange: (
    modelProperty: ChangeableProperty,
    value: number | string | boolean | null | undefined,
  ) => void;
  readonly?: boolean;
  curves?: Curves;
  patterns?: Patterns;
  labelManager?: LabelManager;
  onOpenLibrary?: (
    library: "curves" | "patterns" | "pumps",
    filterByType?: CurveType | PatternType,
  ) => void;
};

export function SummaryValueRow({
  propertyStats,
  config,
  onPropertyChange,
  readonly = false,
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
        <div className="shrink-0 w-7" />
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
}: {
  propertyStats: PropertyStats;
}) {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const label =
    propertyStats.type === "quantity" && propertyStats.unit
      ? `${translate(propertyStats.property)} (${translateUnit(propertyStats.unit)})`
      : translate(propertyStats.property);

  const { emptyBucket, isMixed, singleValue, hasOnlyEmpty, decimals } =
    useSummaryPrimitives(propertyStats);

  if (propertyStats.type === "boolean") {
    const isChecked = !isMixed && singleValue === "yes";

    return (
      <InlineField name={label} labelSize="md">
        <div className="flex items-center gap-1">
          <div className="shrink-0 w-7" />
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
        <div className="shrink-0 w-7" />
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
