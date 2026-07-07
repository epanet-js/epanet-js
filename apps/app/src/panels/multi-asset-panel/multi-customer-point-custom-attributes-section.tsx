import { useCallback, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttribute,
  type CustomAttributeId,
  type CustomAttributeValue,
  getAttributes,
} from "@epanet-js/custom-attributes";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { changeCustomerPointProperty } from "src/hydraulic-model/model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { Section, InlineField } from "src/components/form/fields";
import { NumericField } from "src/components/form/numeric-field";
import { EditableTextField } from "src/components/form/editable-text-field";
import {
  PaywallLockButton,
  PaywallOverlay,
  useFeatureLock,
} from "src/components/form/paywall";
import {
  buildCustomAttributeStats,
  buildCustomAttributeSummary,
} from "./custom-attributes-stats";
import { getDistinctBucketCount, getEmptyBucket } from "./stats";
import { getDistinctBucketCount as getSummaryDistinctBucketCount } from "./summary-stats";
import { StatsPopoverButton } from "./multi-value-row";
import { LazyStatsPopoverButton } from "./summary-value-row";

export function MultiCustomerPointCustomAttributesSection({
  customerPointIds,
  readonly = false,
  onSelectCustomerPoints,
}: {
  customerPointIds: number[];
  readonly?: boolean;
  onSelectCustomerPoints?: (
    customerPointIds: number[],
    property: string,
  ) => void;
}) {
  const isCustomAttributesOn = useFeatureFlag("FLAG_CUSTOM_ATTRIBUTES");
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useMomentTransaction();

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      transact(
        changeCustomerPointProperty(hydraulicModel, {
          customerPointIds,
          property: attributeId,
          value,
        }),
      );
    },
    [transact, customerPointIds, hydraulicModel],
  );

  if (!isCustomAttributesOn) return null;

  const attributes = getAttributes(
    hydraulicModel.customAttributes,
    "customerPoint",
  );
  if (attributes.length === 0 || customerPointIds.length === 0) return null;

  return (
    <Section title="Custom attributes" variant="secondary">
      {attributes.map((attribute) => (
        <MultiCustomAttributeRow
          key={attribute.id}
          attribute={attribute}
          customerPointIds={customerPointIds}
          readonly={readonly}
          onChange={handleChange}
          onSelectCustomerPoints={onSelectCustomerPoints}
        />
      ))}
    </Section>
  );
}

const MultiCustomAttributeRow = ({
  attribute,
  customerPointIds,
  readonly,
  onChange,
  onSelectCustomerPoints,
}: {
  attribute: CustomAttribute;
  customerPointIds: number[];
  readonly: boolean;
  onChange: (
    attributeId: CustomAttributeId,
    value: CustomAttributeValue,
  ) => void;
  onSelectCustomerPoints?: (
    customerPointIds: number[],
    property: string,
  ) => void;
}) => {
  const translate = useTranslate();
  const isStatsPerfOn = useFeatureFlag("FLAG_STATS_PERF");
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const { customerPoints } = useAtomValue(stagingModelDerivedAtom);
  const { isLocked } = useFeatureLock("customAttributes");
  const paywall = isLocked ? "customAttributes" : undefined;

  const valuesById = customerPointIds.map(
    (id) =>
      [
        id,
        (customerPoints.get(id)?.getProperty(attribute.id) ??
          null) as CustomAttributeValue,
      ] as [number, CustomAttributeValue],
  );

  let distinctBuckets: number;
  let statsButton: ReactNode;
  if (isStatsPerfOn) {
    const summary = buildCustomAttributeSummary(
      attribute,
      valuesById,
      units,
      formatting,
    );
    distinctBuckets = getSummaryDistinctBucketCount(summary);
    statsButton =
      distinctBuckets > 1 ? (
        <LazyStatsPopoverButton
          label={attribute.label}
          property={attribute.id}
          loadDetails={() =>
            buildCustomAttributeStats(attribute, valuesById, units, formatting)
          }
          onSelectAssets={onSelectCustomerPoints}
        />
      ) : (
        <div className="shrink-0 w-7" />
      );
  } else {
    const propertyStats = buildCustomAttributeStats(
      attribute,
      valuesById,
      units,
      formatting,
    );
    distinctBuckets = getDistinctBucketCount(propertyStats);
    const emptyBucket = getEmptyBucket(propertyStats);
    statsButton =
      distinctBuckets > 1 ? (
        <StatsPopoverButton
          propertyStats={propertyStats}
          label={attribute.label}
          onSelectAssets={onSelectCustomerPoints}
          emptyBucket={emptyBucket}
        />
      ) : (
        <div className="shrink-0 w-7" />
      );
  }

  const isMixed = distinctBuckets > 1;

  const representative = isMixed
    ? null
    : (valuesById.find(([, value]) => value !== null)?.[1] ?? null);
  const displayValue = representative == null ? "" : String(representative);
  const mixedPlaceholder = `${distinctBuckets} ${translate("values").toLowerCase()}`;

  const field =
    attribute.type === "number" ? (
      <NumericField
        label={attribute.label}
        displayValue={displayValue}
        placeholder={isMixed ? mixedPlaceholder : undefined}
        disabled={readonly}
        styleOptions={{}}
        onChangeValue={(newValue, isEmpty) =>
          onChange(attribute.id, isEmpty ? null : newValue)
        }
      />
    ) : (
      <EditableTextField
        label={attribute.label}
        value={displayValue}
        placeholder={isMixed ? mixedPlaceholder : undefined}
        allowEmpty
        disabled={readonly}
        styleOptions={{ textSize: "sm" }}
        onChangeValue={(newValue) => {
          onChange(attribute.id, newValue === "" ? null : newValue);
          return false;
        }}
      />
    );

  return (
    <InlineField
      name={attribute.label}
      labelSize="md"
      labelAction={
        paywall ? (
          <PaywallLockButton feature={paywall} label={attribute.label} />
        ) : undefined
      }
    >
      <div className="flex items-center gap-1">
        {statsButton}
        <div className="flex-1 min-w-0">
          {paywall ? (
            <PaywallOverlay feature={paywall} ariaLabel={attribute.label}>
              {field}
            </PaywallOverlay>
          ) : (
            field
          )}
        </div>
      </div>
    </InlineField>
  );
};
