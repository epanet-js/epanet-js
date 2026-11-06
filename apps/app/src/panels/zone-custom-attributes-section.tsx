import { useCallback } from "react";
import { useAtomValue } from "jotai";
import {
  type CustomAttributeId,
  type CustomAttributeValue,
  type Zone,
  getAttribute,
  getAttributes,
} from "@epanet-js/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useZoneComparison } from "src/hooks/use-zone-comparison";
import { changeZoneProperty } from "@epanet-js/hydraulic-model-operations";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { SectionWrapper } from "./asset-panel/ui-components";
import { CustomAttributeRow } from "./custom-attribute-row";

export const ZoneCustomAttributesSection = ({
  zone,
  readOnly = false,
}: {
  zone: Zone;
  readOnly?: boolean;
}) => {
  const translate = useTranslate();
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();
  const { getComparison } = useZoneComparison(zone.id);

  const handleChange = useCallback(
    (attributeId: CustomAttributeId, value: CustomAttributeValue) => {
      transact(() =>
        changeZoneProperty(hydraulicModel, {
          zoneIds: [zone.id],
          property: attributeId,
          value,
        }),
      );
      const attribute = getAttribute(
        hydraulicModel.customAttributes,
        "zone",
        attributeId,
      );
      userTracking.capture({
        name: "customAttribute.edited",
        assetType: "zone",
        attributeType: attribute?.type ?? "text",
        property: attributeId,
        label: attribute?.label ?? "",
      });
    },
    [transact, hydraulicModel, zone.id, userTracking],
  );

  const attributes = getAttributes(hydraulicModel.customAttributes, "zone");
  if (attributes.length === 0) return null;

  const hasChanged = attributes.some((attribute) => {
    const value = (zone.getProperty(attribute.id) ??
      null) as CustomAttributeValue;
    return getComparison(attribute.id, value).hasChanged;
  });

  return (
    <SectionWrapper
      title={translate("customAttributes.title")}
      section="customAttributes"
      hasChanged={hasChanged}
    >
      {attributes.map((attribute) => {
        const value = (zone.getProperty(attribute.id) ??
          null) as CustomAttributeValue;
        return (
          <CustomAttributeRow
            key={attribute.id}
            attribute={attribute}
            value={value}
            comparison={getComparison(attribute.id, value)}
            readOnly={readOnly}
            onChange={handleChange}
          />
        );
      })}
    </SectionWrapper>
  );
};
