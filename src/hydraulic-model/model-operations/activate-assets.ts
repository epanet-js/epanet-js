import { AssetId } from "../asset-types";
import type { AssetPatch } from "../model-operation";
import { ModelOperation } from "../model-operation";

type InputData = {
  assetIds: AssetId[];
};

export const activateAssets: ModelOperation<InputData> = (
  { assets, topology },
  { assetIds },
) => {
  const seen = new Set<AssetId>();
  const patches: AssetPatch[] = [];

  const addPatch = (id: AssetId) => {
    if (seen.has(id)) return;
    const asset = assets.get(id);
    if (!asset || asset.isActive) return;
    seen.add(id);
    patches.push({
      id,
      type: asset.type,
      properties: { isActive: true },
    } as AssetPatch);
  };

  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`Invalid asset id ${assetId}`);

    if (!asset.isLink) continue;

    addPatch(assetId);

    const [startNodeId, endNodeId] = topology.getNodes(assetId);
    addPatch(startNodeId);
    addPatch(endNodeId);
  }

  return { note: "Activate assets", patchAssetsAttributes: patches };
};
