import {
  CustomAttributesDefinition,
  customPropertyKey,
  getAttributeIds,
} from "@epanet-js/custom-attributes";
import type { AssetPatch, ModelMoment } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";

export const changeCustomAttributesDefinition = (
  { assets, customAttributes }: HydraulicModel,
  next: CustomAttributesDefinition,
): ModelMoment => {
  const previousIds = getAttributeIds(customAttributes);
  const nextIds = getAttributeIds(next);
  const removedIds = [...previousIds].filter((id) => !nextIds.has(id));

  const patchAssetsAttributes: AssetPatch[] = [];
  if (removedIds.length > 0) {
    for (const asset of assets.values()) {
      const properties: Record<string, unknown> = {};
      for (const id of removedIds) {
        const key = customPropertyKey(id);
        if (asset.hasProperty(key)) {
          properties[key] = null;
        }
      }
      if (Object.keys(properties).length > 0) {
        patchAssetsAttributes.push({
          id: asset.id,
          type: asset.type,
          properties,
        } as AssetPatch);
      }
    }
  }

  return {
    note: "Change custom attributes",
    putCustomAttributesDefinition: next,
    patchAssetsAttributes,
  };
};
