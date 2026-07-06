import {
  AssetId,
  Asset,
  Pipe,
  NodeAsset,
  LinkAsset,
  CustomerPoint,
  CustomerPointsLookup,
  Control,
  AssetReference,
} from "@epanet-js/hydraulic-model";
import type {
  AssetPatch,
  DemandAssignment,
  DemandSettingsChange,
} from "../model-operation";
import { ModelOperation } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { inferNodeIsActive } from "../utilities/active-topology";
import { Demands, getJunctionDemands } from "@epanet-js/hydraulic-model";

type InputData = {
  assetIds: readonly AssetId[];
  shouldUpdateCustomerPoints?: boolean;
  shouldRemoveRawControls?: boolean;
};

export const deleteAssets: ModelOperation<InputData> = (
  hydraulicModel,
  {
    assetIds,
    shouldUpdateCustomerPoints = false,
    shouldRemoveRawControls = false,
  },
) => {
  const {
    topology,
    assets,
    customerPointsLookup,
    controlsLookup,
    controls,
    rawControls,
  } = hydraulicModel;
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

  const putDemands = removeDemandsFromDeletedJunctions(
    hydraulicModel.demands,
    assets,
    affectedIds,
  );

  const controlsToRemove = new Set<Control>();
  for (const id of affectedIds) {
    for (const control of controlsLookup.getControls(id)) {
      controlsToRemove.add(control);
    }
  }
  const putControls =
    controlsToRemove.size > 0
      ? controls.filter((control) => !controlsToRemove.has(control))
      : undefined;

  const putRawControls = shouldRemoveRawControls
    ? removeRawControlsReferencing(rawControls, affectedIds)
    : undefined;

  return {
    note: "Delete assets",
    deleteAssets: Array.from(affectedIds),
    patchAssetsAttributes:
      boundaryPatches.length > 0 ? boundaryPatches : undefined,
    putCustomerPoints:
      shouldUpdateCustomerPoints && disconnectedCustomerPoints.size > 0
        ? Array.from(disconnectedCustomerPoints.values())
        : undefined,
    ...(putDemands && { putDemands }),
    ...(putControls && { putControls }),
    ...(putRawControls && { putRawControls }),
  };
};

const removeRawControlsReferencing = (
  rawControls: HydraulicModel["rawControls"],
  deletedIds: Set<AssetId>,
): HydraulicModel["rawControls"] | undefined => {
  const referencesDeleted = (references: AssetReference[]) =>
    references.some((reference) => deletedIds.has(reference.assetId));

  const simple = rawControls.simple.filter(
    (control) => !referencesDeleted(control.assetReferences),
  );
  const rules = rawControls.rules.filter(
    (rule) => !referencesDeleted(rule.assetReferences),
  );

  const changed =
    simple.length !== rawControls.simple.length ||
    rules.length !== rawControls.rules.length;

  return changed ? { simple, rules } : undefined;
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
