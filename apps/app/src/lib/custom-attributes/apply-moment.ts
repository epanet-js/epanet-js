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
    const { assetId, attributeId } = change;
    reverseValues.push({
      assetId,
      attributeId,
      value: getValue(nextData, assetId, attributeId),
    });
    nextData = setValue(nextData, assetId, attributeId, change.value);
  }

  return { data: nextData, reverse: { putValues: reverseValues } };
};
