import {
  type CustomAttributes,
  type CustomAttributesDefinition,
  type CustomAttributeValues,
  getAttributeIds,
  removeAttributes,
} from "@epanet-js/custom-attributes";
import type { Moment } from "src/lib/persistence/moment";
import type { CustomAttributeAssetValues } from "../moment";

export const updateCustomAttributesDefinition = (
  { definition, data }: CustomAttributes,
  next: CustomAttributesDefinition,
): Moment => {
  const previousIds = getAttributeIds(definition);
  const nextIds = getAttributeIds(next);
  const removedIds = new Set([...previousIds].filter((id) => !nextIds.has(id)));

  const putValues: CustomAttributeAssetValues[] = [];
  if (removedIds.size > 0) {
    const strippedData = removeAttributes(data, removedIds);
    for (const [assetId, values] of data) {
      const affected = [...values.keys()].some((id) => removedIds.has(id));
      if (affected) {
        const stripped: CustomAttributeValues =
          strippedData.get(assetId) ?? new Map();
        putValues.push({ assetId, values: stripped });
      }
    }
  }

  return {
    note: "Update custom attributes",
    customAttributes: { putDefinition: next, putValues },
  };
};
