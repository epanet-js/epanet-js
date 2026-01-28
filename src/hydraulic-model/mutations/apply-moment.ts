import { HydraulicModel } from "../hydraulic-model";
import { ModelMoment } from "../model-operation";
import { Asset, LinkAsset } from "../asset-types";
import { AssetId } from "../assets-map";
import { CustomerPoint } from "../customer-points";
import { ICurve } from "../curves";
import { Demands } from "../demands";

export const applyMomentToModel = (
  hydraulicModel: HydraulicModel,
  moment: ModelMoment,
): void => {
  for (const id of moment.deleteAssets || []) {
    deleteAsset(hydraulicModel, id);
  }

  for (const asset of moment.putAssets || []) {
    putAsset(hydraulicModel, asset);
  }

  for (const cp of moment.putCustomerPoints || []) {
    putCustomerPoint(hydraulicModel, cp);
  }

  for (const curve of moment.putCurves || []) {
    putCurve(hydraulicModel, curve);
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
};

const deleteAsset = (hydraulicModel: HydraulicModel, id: AssetId): void => {
  const asset = hydraulicModel.assets.get(id);
  if (!asset) return;

  if (asset.isLink) {
    hydraulicModel.assetIndex.removeLink(asset.id);
  } else if (asset.isNode) {
    hydraulicModel.assetIndex.removeNode(asset.id);
  }

  hydraulicModel.assets.delete(id);
  hydraulicModel.topology.removeNode(id);
  hydraulicModel.topology.removeLink(id);
  hydraulicModel.labelManager.remove(asset.label, asset.type, asset.id);
};

const putAsset = (hydraulicModel: HydraulicModel, asset: Asset): void => {
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
};

const putCustomerPoint = (
  hydraulicModel: HydraulicModel,
  customerPoint: CustomerPoint,
): void => {
  const oldVersion = hydraulicModel.customerPoints.get(customerPoint.id);
  if (oldVersion) {
    hydraulicModel.customerPointsLookup.removeConnection(oldVersion);
  }
  hydraulicModel.customerPointsLookup.addConnection(customerPoint);
  hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
};

const putCurve = (hydraulicModel: HydraulicModel, curve: ICurve): void => {
  hydraulicModel.curves.set(curve.id, curve);
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
