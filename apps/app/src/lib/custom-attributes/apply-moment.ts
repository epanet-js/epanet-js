import {
  type CustomAttributesData,
  type CustomAttributesDefinition,
  type CustomAttributeValues,
  setAssetValues,
} from "@epanet-js/custom-attributes";
import type {
  CustomAttributeAssetValues,
  CustomAttributesMoment,
} from "./moment";

export const applyMomentToCustomAttributes = (
  data: CustomAttributesData,
  definition: CustomAttributesDefinition,
  moment: CustomAttributesMoment,
): {
  data: CustomAttributesData;
  definition: CustomAttributesDefinition;
  reverse: CustomAttributesMoment;
} => {
  const nextDefinition = moment.putDefinition ?? definition;

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
    reverseValues.push({ assetId, values: reverseMap });

    nextData = setAssetValues(nextData, assetId, values);
  }

  return {
    data: nextData,
    definition: nextDefinition,
    reverse: {
      putValues: reverseValues,
      putDefinition: moment.putDefinition ? definition : undefined,
    },
  };
};
