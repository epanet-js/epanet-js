import {
  AssetId,
  Asset,
  Pipe,
  Pump,
  NodeAsset,
  LinkAsset,
} from "../asset-types";
import { Curves } from "../curves";
import type {
  AssetPatch,
  DemandAssignment,
  DemandSettingsChange,
} from "../model-operation";
import { ModelOperation } from "../model-operation";
import { CustomerPoint } from "../customer-points";
import { CustomerPointsLookup } from "../customer-points-lookup";
import { HydraulicModel } from "../hydraulic-model";
import { inferNodeIsActive } from "../utilities/active-topology";
import { Demands, getJunctionDemands } from "../demands";

type InputData = {
  assetIds: readonly AssetId[];
  shouldUpdateCustomerPoints?: boolean;
};

export const deleteAssets: ModelOperation<InputData> = (
  hydraulicModel,
  { assetIds, shouldUpdateCustomerPoints = false },
) => {
  const { topology, assets, customerPointsLookup } = hydraulicModel;
  const affectedIds = new Set(assetIds);
  const disconnectedCustomerPoints = new Map<number, CustomerPoint>();

  assetIds.forEach((id) => {
    if (shouldUpdateCustomerPoints) {
      const asset = assets.get(id);
      addCustomerPointsToDisconnect(
        asset,
        disconnectedCustomerPoints,
        customerPointsLookup,
      );
    }

    const maybeNodeId = id;
    topology.getLinks(maybeNodeId).forEach((linkId) => {
      affectedIds.add(linkId);
      if (shouldUpdateCustomerPoints) {
        const link = assets.get(linkId);
        addCustomerPointsToDisconnect(
          link,
          disconnectedCustomerPoints,
          customerPointsLookup,
        );
      }
    });
  });

  const boundaryPatches = reevaluateBoundaryNodes(hydraulicModel, affectedIds);
  const putCurves = removePumpsFromCurveAssetIds(
    hydraulicModel.curves,
    assets,
    affectedIds,
  );

  const putDemands = removeDemandsFromDeletedJunctions(
    hydraulicModel.demands,
    assets,
    affectedIds,
  );

  return {
    note: "Delete assets",
    deleteAssets: Array.from(affectedIds),
    patchAssetsAttributes:
      boundaryPatches.length > 0 ? boundaryPatches : undefined,
    putCustomerPoints:
      shouldUpdateCustomerPoints && disconnectedCustomerPoints.size > 0
        ? Array.from(disconnectedCustomerPoints.values())
        : undefined,
    ...(putCurves && { putCurves }),
    ...(putDemands && { putDemands }),
  };
};

const addCustomerPointsToDisconnect = (
  asset: Asset | undefined,
  disconnectedCustomerPoints: Map<number, CustomerPoint>,
  customerPointsLookup: CustomerPointsLookup,
) => {
  if (!asset || asset.type !== "pipe") return;

  const pipe = asset as Pipe;
  const connectedCustomerPoints = customerPointsLookup.getCustomerPoints(
    pipe.id,
  );
  for (const customerPoint of connectedCustomerPoints) {
    if (!disconnectedCustomerPoints.has(customerPoint.id)) {
      const disconnectedCopy = customerPoint.copyDisconnected();
      disconnectedCustomerPoints.set(customerPoint.id, disconnectedCopy);
    }
  }
};

const reevaluateBoundaryNodes = (
  hydraulicModel: HydraulicModel,
  deletedAssetIds: Set<AssetId>,
): AssetPatch[] => {
  const { topology, assets } = hydraulicModel;
  const boundaryNodeIds = new Set<AssetId>();
  const patches: AssetPatch[] = [];

  for (const assetId of deletedAssetIds) {
    const link = assets.get(assetId) as LinkAsset | undefined;
    if (!link || !link.isLink) continue;

    for (const nodeId of link.connections) {
      if (!deletedAssetIds.has(nodeId)) boundaryNodeIds.add(nodeId);
    }
  }

  for (const nodeId of boundaryNodeIds) {
    const node = assets.get(nodeId) as NodeAsset;
    if (!node || node.isLink) continue;
    const inferredState = inferNodeIsActive(
      node,
      deletedAssetIds,
      [],
      topology,
      assets,
    );

    if (inferredState !== node.isActive) {
      patches.push({
        id: nodeId,
        type: node.type,
        properties: { isActive: inferredState },
      } as AssetPatch);
    }
  }

  return patches;
};

const removePumpsFromCurveAssetIds = (
  curves: Curves,
  assets: Map<AssetId, Asset>,
  deletedIds: Set<AssetId>,
): Curves | undefined => {
  let updated: Curves | undefined;

  for (const id of deletedIds) {
    const asset = assets.get(id);
    if (!asset || asset.type !== "pump") continue;
    const pump = asset as Pump;
    if (pump.definitionType !== "curveId" || pump.curveId === undefined)
      continue;

    if (!updated) updated = new Map(curves);
    const curve = updated.get(pump.curveId);
    if (curve) {
      const assetIds = new Set(curve.assetIds);
      assetIds.delete(id);
      updated.set(pump.curveId, { ...curve, assetIds });
    }
  }

  return updated;
};

const removeDemandsFromDeletedJunctions = (
  demands: Demands,
  assets: Map<AssetId, Asset>,
  deletedIds: Set<AssetId>,
): DemandSettingsChange | undefined => {
  let updated: DemandAssignment[] | undefined;

  for (const id of deletedIds) {
    const asset = assets.get(id);
    if (!asset || asset.type !== "junction") continue;
    const demand = getJunctionDemands(demands, id);
    if (!demand.length) continue;

    if (!updated) updated = [];
    updated.push({ junctionId: id, demands: [] });
  }

  return updated ? { assignments: updated } : undefined;
};
