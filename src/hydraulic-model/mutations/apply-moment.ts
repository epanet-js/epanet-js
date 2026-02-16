import { HydraulicModel } from "../hydraulic-model";
import { ModelMoment, ReverseMoment } from "../model-operation";
import type { AssetPatch } from "../model-operation";
import { Asset, LinkAsset } from "../asset-types";
import { AssetId } from "../assets-map";
import { CustomerPoint } from "../customer-points";
import { Curves } from "../curves";
import { Demands } from "../demands";
import { isDebugOn } from "src/infra/debug-mode";

type PutAssetResult = {
  oldAsset: Asset | undefined;
  isNew: boolean;
};

export const applyMomentToModel = (
  hydraulicModel: HydraulicModel,
  moment: ModelMoment,
): ReverseMoment => {
  if (isDebugOn) {
    assertNoPutPatchOverlap(moment);
  }

  const reverseMoment: ReverseMoment = {
    note: `Reverse: ${moment.note}`,
    putAssets: [],
    deleteAssets: [],
    patchAssetsAttributes: [],
    putCustomerPoints: [],
  };

  if (moment.putDemands) {
    reverseMoment.putDemands = hydraulicModel.demands;
  }
  if (moment.putEPSTiming) {
    reverseMoment.putEPSTiming = hydraulicModel.epsTiming;
  }
  if (moment.putControls) {
    reverseMoment.putControls = hydraulicModel.controls;
  }
  if (moment.putCurves) {
    reverseMoment.putCurves = hydraulicModel.curves;
  }

  for (const id of moment.deleteAssets || []) {
    const deleted = deleteAsset(hydraulicModel, id);
    if (deleted) {
      reverseMoment.putAssets.push(deleted);
    }
  }

  for (const asset of moment.putAssets || []) {
    const result = putAsset(hydraulicModel, asset);
    if (result.oldAsset) {
      reverseMoment.putAssets.push(result.oldAsset);
    } else {
      reverseMoment.deleteAssets.push(asset.id);
    }
  }

  for (const patch of moment.patchAssetsAttributes || []) {
    const reversePatch = patchAssetAttributes(hydraulicModel, patch);
    if (reversePatch) {
      reverseMoment.patchAssetsAttributes.push(reversePatch);
    }
  }

  for (const cp of moment.putCustomerPoints || []) {
    const oldCp = putCustomerPoint(hydraulicModel, cp);
    if (oldCp) {
      reverseMoment.putCustomerPoints.push(oldCp);
    }
  }

  if (moment.putDemands) {
    putDemands(hydraulicModel, moment.putDemands);
  }

  if (moment.putEPSTiming) {
    hydraulicModel.epsTiming = moment.putEPSTiming;
  }

  if (moment.putControls) {
    hydraulicModel.controls = moment.putControls;
  }

  if (moment.putCurves) {
    putCurves(hydraulicModel, moment.putCurves);
  }

  return reverseMoment;
};

const deleteAsset = (
  hydraulicModel: HydraulicModel,
  id: AssetId,
): Asset | undefined => {
  const asset = hydraulicModel.assets.get(id);
  if (!asset) return undefined;

  if (asset.isLink) {
    hydraulicModel.assetIndex.removeLink(asset.id);
  } else if (asset.isNode) {
    hydraulicModel.assetIndex.removeNode(asset.id);
  }

  hydraulicModel.assets.delete(id);
  hydraulicModel.topology.removeNode(id);
  hydraulicModel.topology.removeLink(id);
  hydraulicModel.labelManager.remove(asset.label, asset.type, asset.id);

  return asset;
};

const putAsset = (
  hydraulicModel: HydraulicModel,
  asset: Asset,
): PutAssetResult => {
  const oldVersion = hydraulicModel.assets.get(asset.id);

  hydraulicModel.assets.set(asset.id, asset);

  if (asset.isLink) {
    hydraulicModel.assetIndex.addLink(asset.id);
  } else if (asset.isNode) {
    hydraulicModel.assetIndex.addNode(asset.id);
  }

  if (oldVersion && hydraulicModel.topology.hasLink(oldVersion.id)) {
    const oldLink = oldVersion as LinkAsset;
    oldLink.connections && hydraulicModel.topology.removeLink(oldVersion.id);
    hydraulicModel.labelManager.remove(
      oldVersion.label,
      oldVersion.type,
      oldVersion.id,
    );
  }

  if (asset.isLink) {
    const link = asset as LinkAsset;
    if (link.connections) {
      const [start, end] = link.connections;
      hydraulicModel.topology.addLink(asset.id, start, end);
    }
  }

  hydraulicModel.labelManager.register(asset.label, asset.type, asset.id);

  return {
    oldAsset: oldVersion,
    isNew: !oldVersion,
  };
};

const putCustomerPoint = (
  hydraulicModel: HydraulicModel,
  customerPoint: CustomerPoint,
): CustomerPoint | undefined => {
  const oldVersion = hydraulicModel.customerPoints.get(customerPoint.id);
  if (oldVersion) {
    hydraulicModel.customerPointsLookup.removeConnection(oldVersion);
  }
  hydraulicModel.customerPointsLookup.addConnection(customerPoint);
  hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);

  return oldVersion;
};

const putCurves = (hydraulicModel: HydraulicModel, curves: Curves): void => {
  for (const curve of hydraulicModel.curves.values()) {
    hydraulicModel.labelManager.remove(curve.label, "curve", curve.id);
  }
  hydraulicModel.curves = curves;
  for (const curve of curves.values()) {
    hydraulicModel.labelManager.register(curve.label, "curve", curve.id);
  }
};

const patchAssetAttributes = (
  hydraulicModel: HydraulicModel,
  patch: AssetPatch,
): AssetPatch | undefined => {
  const asset = hydraulicModel.assets.get(patch.id);
  if (!asset) return undefined;

  const reverseProperties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch.properties)) {
    reverseProperties[key] = asset.getProperty(key);
    asset.setProperty(key, value as NonNullable<unknown>);
  }

  if ("label" in patch.properties) {
    hydraulicModel.labelManager.remove(
      reverseProperties.label as string,
      asset.type,
      asset.id,
    );
    hydraulicModel.labelManager.register(asset.label, asset.type, asset.id);
  }

  return {
    id: patch.id,
    type: patch.type,
    properties: reverseProperties,
  } as AssetPatch;
};

const putDemands = (hydraulicModel: HydraulicModel, demands: Demands): void => {
  for (const pattern of hydraulicModel.demands.patterns.values()) {
    hydraulicModel.labelManager.remove(pattern.label, "pattern", pattern.id);
  }
  hydraulicModel.demands = demands;
  for (const pattern of demands.patterns.values()) {
    hydraulicModel.labelManager.register(pattern.label, "pattern", pattern.id);
  }
};

const assertNoPutPatchOverlap = (moment: ModelMoment): void => {
  const putAssets = moment.putAssets;
  const patchAssets = moment.patchAssetsAttributes;
  if (putAssets?.length && patchAssets?.length)
    throw new Error(
      `Moment "${moment.note}" has both putAssets and patchAssetsAttributes`,
    );
};
