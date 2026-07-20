import { useCallback, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttribute,
  type CustomAttributeAssetType,
  type CustomAttributeId,
  type CustomAttributeValue,
  getAttribute,
  getAttributes,
} from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { changeProperty } from "src/hydraulic-model/model-operations";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
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

export function MultiCustomAttributesSection({
  assetType,
  assetIds,
  readonly = false,
  onSelectAssets,
}: {
  assetType: CustomAttributeAssetType;
  assetIds: number[];
  readonly?: boolean;
  onSelectAssets?: (assetIds: number[], property: string) => void;
}) {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useMomentTransaction();
  const userTracking = useUserTracking();

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      transact(
        changeProperty(hydraulicModel, {
          assetIds,
          property: attributeId as ChangeableProperty,
          value: value as never,
        }),
      );
      const attribute = getAttribute(
        hydraulicModel.customAttributes,
        assetType,
        attributeId,
      );
      userTracking.capture({
        name: "customAttribute.batchEdited",
        assetType,
        attributeType: attribute?.type ?? "text",
        property: attributeId,
        label: attribute?.label ?? "",
        count: assetIds.length,
      });
    },
    [transact, assetIds, assetType, hydraulicModel, userTracking],
  );

  const attributes = getAttributes(hydraulicModel.customAttributes, assetType);
  if (attributes.length === 0 || assetIds.length === 0) return null;

  return (
    <Section title={translate("customAttributes.title")} variant="secondary">
      {attributes.map((attribute) => (
        <MultiCustomAttributeRow
          key={attribute.id}
          attribute={attribute}
          assetIds={assetIds}
          readonly={readonly}
          onChange={handleChange}
          onSelectAssets={onSelectAssets}
        />
      ))}
    </Section>
  );
}

const MultiCustomAttributeRow = ({
  attribute,
  assetIds,
  readonly,
  onChange,
  onSelectAssets,
}: {
  attribute: CustomAttribute;
  assetIds: number[];
  readonly: boolean;
  onChange: (
    attributeId: CustomAttributeId,
    value: CustomAttributeValue,
  ) => void;
  onSelectAssets?: (assetIds: number[], property: string) => void;
}) => {
  const translate = useTranslate();
  const isStatsPerfOn = useFeatureFlag("FLAG_STATS_PERF");
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const { assets } = useAtomValue(stagingModelDerivedAtom);
  const { isLocked } = useFeatureLock("customAttributes");
  const paywall = isLocked ? "customAttributes" : undefined;

  const valuesById = assetIds.map(
    (id) =>
      [
        id,
        (assets.get(id)?.getProperty(attribute.id) ??
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
          onSelectAssets={onSelectAssets}
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
          onSelectAssets={onSelectAssets}
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
