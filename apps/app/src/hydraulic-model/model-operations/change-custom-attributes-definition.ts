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
import type { ChangeSet } from "@epanet-js/change-set";
import {
  changeSet,
  replaceCustomAttributes,
  setAsset,
  setCustomerPoint,
  type Fields,
} from "../change-sets";

export const changeCustomAttributesDefinition = (
  model: HydraulicModel,
  next: CustomAttributesDefinition,
): ChangeSet => {
  const { patchAssetsAttributes, patchCustomerPointsAttributes } =
    planClearedValues(model, next);

  return changeSet(model, "Change custom attributes", [
    replaceCustomAttributes(next),
    ...patchAssetsAttributes.map((patch) =>
      setAsset(patch.id, patch.properties as Fields),
    ),
    ...patchCustomerPointsAttributes.map((patch) =>
      setCustomerPoint(patch.id, patch.properties as Fields),
    ),
  ]);
};

export const changeCustomAttributesDefinitionDeprecated = (
  model: HydraulicModel,
  next: CustomAttributesDefinition,
): ModelMoment => {
  const { patchAssetsAttributes, patchCustomerPointsAttributes } =
    planClearedValues(model, next);

  return {
    note: "Change custom attributes",
    putCustomAttributesDefinition: next,
    patchAssetsAttributes,
    patchCustomerPointsAttributes,
  };
};

const planClearedValues = (
  { assets, customerPoints, customAttributes }: HydraulicModel,
  next: CustomAttributesDefinition,
) => {
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

  return { patchAssetsAttributes, patchCustomerPointsAttributes };
};
