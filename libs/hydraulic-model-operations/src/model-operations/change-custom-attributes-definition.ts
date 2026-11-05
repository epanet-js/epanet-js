import {
  CustomAttributesDefinition,
  getAttributeIds,
  HydraulicModel,
} from "@epanet-js/hydraulic-model";
import type {
  AssetPatch,
  CustomerPointPatch,
  ZonePatch,
} from "../model-operation";
import type { ChangeSet } from "@epanet-js/change-set";
import {
  changeSet,
  replaceCustomAttributes,
  setAsset,
  setCustomerPoint,
  setZone,
  type Fields,
} from "../change-sets";

export const changeCustomAttributesDefinition = (
  model: HydraulicModel,
  next: CustomAttributesDefinition,
): ChangeSet => {
  const {
    patchAssetsAttributes,
    patchCustomerPointsAttributes,
    patchZonesAttributes,
  } = planClearedValues(model, next);

  return changeSet(model, "changeCustomAttributesDefinition", [
    replaceCustomAttributes(next),
    ...patchAssetsAttributes.map((patch) =>
      setAsset(patch.id, patch.properties as Fields),
    ),
    ...patchCustomerPointsAttributes.map((patch) =>
      setCustomerPoint(patch.id, patch.properties as Fields),
    ),
    ...patchZonesAttributes.map((patch) =>
      setZone(patch.id, patch.properties as Fields),
    ),
  ]);
};

const planClearedValues = (
  { assets, customerPoints, zones, customAttributes }: HydraulicModel,
  next: CustomAttributesDefinition,
) => {
  const previousIds = getAttributeIds(customAttributes);
  const nextIds = getAttributeIds(next);
  const removedIds = [...previousIds].filter((id) => !nextIds.has(id));

  const patchAssetsAttributes: AssetPatch[] = [];
  const patchCustomerPointsAttributes: CustomerPointPatch[] = [];
  const patchZonesAttributes: ZonePatch[] = [];
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

    for (const zone of zones.values()) {
      const properties: Record<string, unknown> = {};
      for (const key of removedIds) {
        if (zone.hasProperty(key)) {
          properties[key] = null;
        }
      }
      if (Object.keys(properties).length > 0) {
        patchZonesAttributes.push({ id: zone.id, properties });
      }
    }
  }

  return {
    patchAssetsAttributes,
    patchCustomerPointsAttributes,
    patchZonesAttributes,
  };
};
