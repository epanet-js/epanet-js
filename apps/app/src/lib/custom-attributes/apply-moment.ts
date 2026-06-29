import {
  type CustomAttributesData,
  getValue,
  setValue,
} from "@epanet-js/custom-attributes";
import type {
  CustomAttributesMoment,
  CustomAttributeValueChange,
} from "./moment";

export const applyMomentToCustomAttributes = (
  data: CustomAttributesData,
  moment: CustomAttributesMoment,
): { data: CustomAttributesData; reverse: CustomAttributesMoment } => {
  let nextData = data;
  const reverseValues: CustomAttributeValueChange[] = [];

  for (const change of moment.putValues) {
    const { assetType, assetId, attributeId } = change;
    reverseValues.push({
      assetType,
      assetId,
      attributeId,
      value: getValue(nextData, assetType, assetId, attributeId),
    });
    nextData = setValue(
      nextData,
      assetType,
      assetId,
      attributeId,
      change.value,
    );
  }

  return { data: nextData, reverse: { putValues: reverseValues } };
};
