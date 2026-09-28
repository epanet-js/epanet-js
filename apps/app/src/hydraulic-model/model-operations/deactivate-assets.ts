import { AssetId } from "@epanet-js/hydraulic-model";
import { AssetsMap } from "@epanet-js/hydraulic-model";
import type { AssetPatch } from "../model-operation";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { TopologyQueries } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "../hydraulic-model";
import { changeSet, setAsset } from "../change-sets";

type InputData = {
  assetIds: AssetId[];
};

export const deactivateAssets: ModelOperation<InputData> = (
  model,
  { assetIds },
) =>
  changeSet(model, "Deactivate assets", [
    setAsset(idsToDeactivate(model, assetIds), { isActive: false }),
  ]);

export const deactivateAssetsDeprecated: ModelOperationDeprecated<InputData> = (
  model,
  { assetIds },
) => {
  const patches = idsToDeactivate(model, assetIds).map(
    (id) =>
      ({
        id,
        type: model.assets.get(id)!.type,
        properties: { isActive: false },
      }) as AssetPatch,
  );

  return { note: "Deactivate assets", patchAssetsAttributes: patches };
};

const idsToDeactivate = (
  { assets, topology }: HydraulicModel,
  assetIds: AssetId[],
): AssetId[] => {
  const ids: AssetId[] = [];
  const linksToDeactivate = new Set<AssetId>();
  const nodesToCheck = new Set<AssetId>();

  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`Invalid asset id ${assetId}`);

    if (!asset.isLink) continue;

    const [startNodeId, endNodeId] = topology.getNodes(assetId);
    const startNode = assets.get(startNodeId);
    const endNode = assets.get(endNodeId);

    if (asset.isActive) {
      linksToDeactivate.add(assetId);
      ids.push(assetId);
    }

    if (startNode?.isActive) nodesToCheck.add(startNodeId);
    if (endNode?.isActive) nodesToCheck.add(endNodeId);
  }

  for (const nodeId of nodesToCheck) {
    const hasActiveLink = hasActiveLinkConnected(
      topology,
      assets,
      nodeId,
      linksToDeactivate,
    );

    if (!hasActiveLink) ids.push(nodeId);
  }

  return ids;
};

function hasActiveLinkConnected(
  topology: TopologyQueries,
  assets: AssetsMap,
  nodeId: AssetId,
  linksToDeactivate: Set<AssetId>,
): boolean {
  const connectedLinks = topology.getLinks(nodeId);
  for (const linkId of connectedLinks) {
    if (linksToDeactivate.has(linkId)) continue;
    const link = assets.get(linkId);
    if (link?.isActive) {
      return true;
    }
  }
  return false;
}
