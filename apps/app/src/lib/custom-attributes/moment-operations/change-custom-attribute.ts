import {
  type CustomAttributes,
  type CustomAttributeValues,
  getAttributeIds,
} from "@epanet-js/custom-attributes";
import type { Moment } from "src/lib/persistence/moment";
import type {
  CustomAttributeAssetValues,
  CustomAttributeValueChange,
} from "../moment";

export const changeCustomAttributes = (
  { definition, data }: CustomAttributes,
  changes: CustomAttributeValueChange[],
): Moment => {
  const validAttributeIds = getAttributeIds(definition);
  const byAsset = new Map<number, CustomAttributeValues>();

  for (const { assetId, attributeId, value } of changes) {
    if (!validAttributeIds.has(attributeId)) continue;

    let values = byAsset.get(assetId);
    if (!values) {
      values = new Map(data.get(assetId));
      byAsset.set(assetId, values);
    }
    values.set(attributeId, value);
  }

  const putValues: CustomAttributeAssetValues[] = [];
  for (const [assetId, values] of byAsset) {
    putValues.push({ assetId, values });
  }

  return { note: "Change custom attribute", customAttributes: { putValues } };
};
