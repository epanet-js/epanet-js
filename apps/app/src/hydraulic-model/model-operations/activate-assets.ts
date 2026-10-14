import { AssetId } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { changeSet, setAsset } from "../change-sets";

type InputData = {
  assetIds: AssetId[];
};

export const activateAssets: ModelOperation<InputData> = (
  model,
  { assetIds },
) =>
  changeSet(model, "activateAssets", [
    setAsset(idsToActivate(model, assetIds), { isActive: true }),
  ]);

const idsToActivate = (
  { assets, topology }: HydraulicModel,
  assetIds: AssetId[],
): AssetId[] => {
  const ids: AssetId[] = [];
  const seen = new Set<AssetId>();

  const add = (id: AssetId) => {
    if (seen.has(id)) return;
    const asset = assets.get(id);
    if (!asset || asset.isActive) return;
    seen.add(id);
    ids.push(id);
  };

  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`Invalid asset id ${assetId}`);

    if (!asset.isLink) continue;

    add(assetId);

    const [startNodeId, endNodeId] = topology.getNodes(assetId);
    add(startNodeId);
    add(endNodeId);
  }

  return ids;
};
