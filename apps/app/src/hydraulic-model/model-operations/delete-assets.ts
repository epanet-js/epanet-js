import {
  AssetId,
  Asset,
  Pipe,
  NodeAsset,
  LinkAsset,
  CustomerPoint,
  CustomerPointsLookup,
  AssetReference,
  detachControlReferences,
} from "@epanet-js/hydraulic-model";
import type { AssetPatch, DemandAssignment } from "../model-operation";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { inferNodeIsActive } from "../utilities/active-topology";
import { Demands, getJunctionDemands } from "@epanet-js/hydraulic-model";
import {
  changeSet,
  dropAssets,
  putCustomerPoints,
  replaceControls,
  setAsset,
  setDemands,
  setRawControls,
  type Fields,
  type Intent,
} from "../change-sets";

type InputData = {
  assetIds: readonly AssetId[];
  shouldUpdateCustomerPoints?: boolean;
  shouldRemoveRawControls?: boolean;
};

export const deleteAssets: ModelOperation<InputData> = (
  hydraulicModel,
  data,
) => {
  const {
    deleteIds,
    boundaryPatches,
    disconnectedCustomerPoints,
    demandAssignments,
    controls,
    rawControls,
  } = planDeletion(hydraulicModel, data);

  const intents: Intent[] = [];
  if (rawControls) intents.push(setRawControls(rawControls));
  if (controls) intents.push(replaceControls(controls));
  intents.push(dropAssets(deleteIds));
  for (const patch of boundaryPatches) {
    intents.push(setAsset(patch.id, patch.properties as Fields));
  }
  intents.push(putCustomerPoints(disconnectedCustomerPoints));
  intents.push(setDemands(demandAssignments));

  return changeSet(hydraulicModel, "deleteAssets", intents);
};

export const deleteAssetsDeprecated: ModelOperationDeprecated<InputData> = (
  hydraulicModel,
  data,
) => {
  const {
    deleteIds,
    boundaryPatches,
    disconnectedCustomerPoints,
    demandAssignments,
    controls,
    rawControls,
  } = planDeletion(hydraulicModel, data);

  return {
    note: "deleteAssets",
    deleteAssets: deleteIds,
    patchAssetsAttributes:
      boundaryPatches.length > 0 ? boundaryPatches : undefined,
    putCustomerPoints:
      disconnectedCustomerPoints.length > 0
        ? disconnectedCustomerPoints
        : undefined,
    ...(demandAssignments.length > 0 && {
      putDemands: { assignments: demandAssignments },
    }),
    ...(controls && { putControls: controls }),
    ...(rawControls && { putRawControls: rawControls }),
  };
};

const planDeletion = (
  hydraulicModel: HydraulicModel,
  {
    assetIds,
    shouldUpdateCustomerPoints = false,
    shouldRemoveRawControls = false,
  }: InputData,
) => {
  const {
    topology,
    assets,
    customerPointsLookup,
    controlsLookup,
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

  const referencesControls = [...affectedIds].some((id) =>
    controlsLookup.hasControls(id),
  );

  return {
    deleteIds: Array.from(affectedIds),
    boundaryPatches: reevaluateBoundaryNodes(hydraulicModel, affectedIds),
    disconnectedCustomerPoints: Array.from(disconnectedCustomerPoints.values()),
    demandAssignments: removeDemandsFromDeletedJunctions(
      hydraulicModel.demands,
      assets,
      affectedIds,
    ),
    controls: referencesControls
      ? (detachControlReferences(
          hydraulicModel.controls,
          affectedIds,
          assets,
        ) ?? undefined)
      : undefined,
    rawControls: shouldRemoveRawControls
      ? removeRawControlsReferencing(rawControls, affectedIds)
      : undefined,
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
): DemandAssignment[] => {
  const assignments: DemandAssignment[] = [];

  for (const id of deletedIds) {
    const asset = assets.get(id);
    if (!asset || asset.type !== "junction") continue;
    const demand = getJunctionDemands(demands, id);
    if (!demand.length) continue;

    assignments.push({ junctionId: id, demands: [] });
  }

  return assignments;
};
