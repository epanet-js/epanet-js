import {
  type CustomAttributeId,
  type CustomAttributesData,
  type CustomAttributeValues,
  filterValues,
  setAssetValues,
} from "@epanet-js/custom-attributes";
import type {
  CustomAttributeAssetValues,
  CustomAttributesMoment,
} from "./moment";

export const applyMomentToCustomAttributes = (
  data: CustomAttributesData,
  moment: CustomAttributesMoment,
  validAttributeIds: Set<CustomAttributeId>,
): { data: CustomAttributesData; reverse: CustomAttributesMoment } => {
  let nextData = data;
  const reverseValues: CustomAttributeAssetValues[] = [];

  for (const { assetId, values } of moment.putValues) {
    const current = nextData.get(assetId);

    const reverseMap: CustomAttributeValues = new Map(current);
    for (const attributeId of values.keys()) {
      if (!reverseMap.has(attributeId)) {
        reverseMap.set(attributeId, null);
      }
    }
    reverseValues.push({
      assetId,
      values: filterValues(reverseMap, validAttributeIds),
    });

    nextData = setAssetValues(
      nextData,
      assetId,
      filterValues(values, validAttributeIds),
    );
  }

  return { data: nextData, reverse: { putValues: reverseValues } };
};
