import { HydraulicModel } from "../hydraulic-model";
import { ModelMoment, ReverseMoment } from "../model-operation";
import { Asset, LinkAsset } from "../asset-types";
import { AssetId } from "../assets-map";
import { CustomerPoint } from "../customer-points";
import { ICurve } from "../curves";
import { Demands } from "../demands";

type PutAssetResult = {
  oldAsset: Asset | undefined;
  isNew: boolean;
};

export const applyMomentToModel = (
  hydraulicModel: HydraulicModel,
  moment: ModelMoment,
): ReverseMoment => {
  const reverseMoment: ReverseMoment = {
    note: `Reverse: ${moment.note}`,
    putAssets: [],
    deleteAssets: [],
    putCustomerPoints: [],
    putCurves: [],
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

  for (const cp of moment.putCustomerPoints || []) {
    const oldCp = putCustomerPoint(hydraulicModel, cp);
    if (oldCp) {
      reverseMoment.putCustomerPoints.push(oldCp);
    }
  }

  for (const curve of moment.putCurves || []) {
    const oldCurve = putCurve(hydraulicModel, curve);
    if (oldCurve) {
      reverseMoment.putCurves.push(oldCurve);
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

const putCurve = (
  hydraulicModel: HydraulicModel,
  curve: ICurve,
): ICurve | undefined => {
  const oldCurve = hydraulicModel.curvesDeprecated.get(curve.label);
  hydraulicModel.curvesDeprecated.set(curve.label, curve);
  return oldCurve;
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
