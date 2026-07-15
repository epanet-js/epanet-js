import {
  CustomAttributesDefinition,
  getAttributeIds,
} from "@epanet-js/hydraulic-model";
import type {
  AssetPatch,
  CustomerPointPatch,
  ModelMoment,
} from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";

export const changeCustomAttributesDefinition = (
  { assets, customerPoints, customAttributes }: HydraulicModel,
  next: CustomAttributesDefinition,
): ModelMoment => {
  const previousIds = getAttributeIds(customAttributes);
  const nextIds = getAttributeIds(next);
  const removedIds = [...previousIds].filter((id) => !nextIds.has(id));

  const patchAssetsAttributes: AssetPatch[] = [];
  const patchCustomerPointsAttributes: CustomerPointPatch[] = [];
  if (removedIds.length > 0) {
    for (const asset of assets.values()) {
      const properties: Record<string, unknown> = {};
      for (const key of removedIds) {
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

    for (const customerPoint of customerPoints.values()) {
      const properties: Record<string, unknown> = {};
      for (const key of removedIds) {
        if (customerPoint.hasProperty(key)) {
          properties[key] = null;
        }
      }
      if (Object.keys(properties).length > 0) {
        patchCustomerPointsAttributes.push({
          id: customerPoint.id,
          properties,
        });
      }
    }
  }

  return {
    note: "Change custom attributes",
    putCustomAttributesDefinition: next,
    patchAssetsAttributes,
    patchCustomerPointsAttributes,
  };
};
