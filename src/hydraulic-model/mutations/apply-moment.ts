import { HydraulicModel } from "../hydraulic-model";
import { ModelMoment, ReverseMoment } from "../model-operation";
import type { AssetPatch, DemandAssignment } from "../model-operation";
import { Asset, LinkAsset } from "../asset-types";
import { AssetId } from "../assets-map";
import { CustomerPoint } from "../customer-points";
import { Curves } from "../curves";
import { Patterns } from "../patterns";
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
    const reverseAssignements = putDemandAssignments(
      hydraulicModel,
      moment.putDemands.assignments || [],
    );
    reverseMoment.putDemands = {
      multiplier: hydraulicModel.demands.multiplier,
      patterns: hydraulicModel.demands.patterns,
      assignments: reverseAssignements,
    };
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
    const deletedDemands = hydraulicModel.demands.assignments.junctions.get(id);
    const deleted = deleteAsset(hydraulicModel, id);
    if (deleted) {
      reverseMoment.putAssets.push(deleted);
      if (deletedDemands && deletedDemands.length > 0) {
        if (!reverseMoment.putDemands) {
          reverseMoment.putDemands = {};
        }
        const assignments = reverseMoment.putDemands.assignments ?? [];
        assignments.push({ junctionId: id, demands: deletedDemands });
        reverseMoment.putDemands.assignments = assignments;
      }
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
    if (moment.putDemands.multiplier !== undefined) {
      hydraulicModel.demands.multiplier = moment.putDemands.multiplier;
    }
    if (moment.putDemands.patterns) {
      putDemandPatterns(hydraulicModel, moment.putDemands.patterns);
    }
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
  hydraulicModel.demands.assignments.junctions.delete(id);

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
  for (const [key] of Object.entries(patch.properties)) {
    reverseProperties[key] = asset.getProperty(key);
  }

  const updatedAsset = asset.copy();
  for (const [key, value] of Object.entries(patch.properties)) {
    updatedAsset.setProperty(key, value as NonNullable<unknown>);
  }
  hydraulicModel.assets.set(patch.id, updatedAsset);

  if ("label" in patch.properties) {
    hydraulicModel.labelManager.remove(
      reverseProperties.label as string,
      asset.type,
      asset.id,
    );
    hydraulicModel.labelManager.register(
      updatedAsset.label,
      updatedAsset.type,
      updatedAsset.id,
    );
  }

  return {
    id: patch.id,
    type: patch.type,
    properties: reverseProperties,
  } as AssetPatch;
};

const putDemandPatterns = (
  hydraulicModel: HydraulicModel,
  patterns: Patterns,
): void => {
  for (const pattern of hydraulicModel.demands.patterns.values()) {
    hydraulicModel.labelManager.remove(pattern.label, "pattern", pattern.id);
  }
  hydraulicModel.demands.patterns = patterns;
  for (const pattern of patterns.values()) {
    hydraulicModel.labelManager.register(pattern.label, "pattern", pattern.id);
  }
};

const putDemandAssignments = (
  hydraulicModel: HydraulicModel,
  assignments: DemandAssignment[],
): DemandAssignment[] => {
  const {
    junctions: junctionAssignements,
    customerPoints: customerPointAssignments,
  } = hydraulicModel.demands.assignments;

  const reverseAssignments: DemandAssignment[] = [];
  assignments.forEach((demandAssignement) => {
    if ("customerPointId" in demandAssignement) {
      const customerDemands = customerPointAssignments.get(
        demandAssignement.customerPointId,
      );
      reverseAssignments.push({
        customerPointId: demandAssignement.customerPointId,
        demands: customerDemands || [],
      });
      if (demandAssignement.demands.length === 0) {
        customerPointAssignments.delete(demandAssignement.customerPointId);
      } else {
        customerPointAssignments.set(
          demandAssignement.customerPointId,
          demandAssignement.demands,
        );
      }
    } else {
      const demands = junctionAssignements.get(demandAssignement.junctionId);
      reverseAssignments.push({
        junctionId: demandAssignement.junctionId,
        demands: demands || [],
      });
      if (demandAssignement.demands.length === 0) {
        junctionAssignements.delete(demandAssignement.junctionId);
      } else {
        junctionAssignements.set(
          demandAssignement.junctionId,
          demandAssignement.demands,
        );
      }
    }
  });
  return reverseAssignments;
};

const assertNoPutPatchOverlap = (moment: ModelMoment): void => {
  const putAssets = moment.putAssets;
  const patchAssets = moment.patchAssetsAttributes;
  if (!putAssets?.length || !patchAssets?.length) return;

  const putIds = new Set(putAssets.map((a) => a.id));
  for (const patch of patchAssets) {
    if (putIds.has(patch.id)) {
      throw new Error(
        `Moment "${moment.note}" has both putAssets and patchAssetsAttributes for asset ${patch.id}`,
      );
    }
  }
};
