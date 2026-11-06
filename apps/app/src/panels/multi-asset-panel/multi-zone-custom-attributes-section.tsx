import { useCallback, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttribute,
  type CustomAttributeId,
  type CustomAttributeValue,
  type ZoneId,
  getAttribute,
  getAttributes,
} from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { changeZoneProperty } from "@epanet-js/hydraulic-model-operations";
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
import { getDistinctBucketCount as getSummaryDistinctBucketCount } from "./summary-stats";
import { LazyStatsPopoverButton } from "./summary-value-row";

export function MultiZoneCustomAttributesSection({
  zoneIds,
  readonly = false,
  onSelectZones,
}: {
  zoneIds: readonly ZoneId[];
  readonly?: boolean;
  onSelectZones?: (zoneIds: number[], property: string) => void;
}) {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      const data = {
        zoneIds: [...zoneIds],
        property: attributeId,
        value,
      };
      transact(() => changeZoneProperty(hydraulicModel, data));
      const attribute = getAttribute(
        hydraulicModel.customAttributes,
        "zone",
        attributeId,
      );
      userTracking.capture({
        name: "customAttribute.batchEdited",
        assetType: "zone",
        attributeType: attribute?.type ?? "text",
        property: attributeId,
        label: attribute?.label ?? "",
        count: zoneIds.length,
      });
    },
    [transact, zoneIds, hydraulicModel, userTracking],
  );

  const attributes = getAttributes(hydraulicModel.customAttributes, "zone");
  if (attributes.length === 0 || zoneIds.length === 0) return null;

  return (
    <Section title={translate("customAttributes.title")} variant="secondary">
      {attributes.map((attribute) => (
        <MultiCustomAttributeRow
          key={attribute.id}
          attribute={attribute}
          zoneIds={zoneIds}
          readonly={readonly}
          onChange={handleChange}
          onSelectZones={onSelectZones}
        />
      ))}
    </Section>
  );
}

const MultiCustomAttributeRow = ({
  attribute,
  zoneIds,
  readonly,
  onChange,
  onSelectZones,
}: {
  attribute: CustomAttribute;
  zoneIds: readonly ZoneId[];
  readonly: boolean;
  onChange: (
    attributeId: CustomAttributeId,
    value: CustomAttributeValue,
  ) => void;
  onSelectZones?: (zoneIds: number[], property: string) => void;
}) => {
  const translate = useTranslate();
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const { zones } = useAtomValue(stagingModelDerivedAtom);
  const { isLocked } = useFeatureLock("customAttributes");
  const paywall = isLocked ? "customAttributes" : undefined;

  const valuesById = zoneIds.map(
    (id) =>
      [
        id,
        (zones.get(id)?.getProperty(attribute.id) ??
          null) as CustomAttributeValue,
      ] as [number, CustomAttributeValue],
  );

  const summary = buildCustomAttributeSummary(
    attribute,
    valuesById,
    units,
    formatting,
  );
  const distinctBuckets = getSummaryDistinctBucketCount(summary);
  const statsButton: ReactNode =
    distinctBuckets > 1 ? (
      <LazyStatsPopoverButton
        label={attribute.label}
        property={attribute.id}
        loadDetails={() =>
          buildCustomAttributeStats(attribute, valuesById, units, formatting)
        }
        onSelectAssets={onSelectZones}
      />
    ) : (
      <div className="shrink-0 w-7" />
    );

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
