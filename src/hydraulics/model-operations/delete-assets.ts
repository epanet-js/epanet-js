import { AssetId } from "../assets";
import { ModelOperation } from "../model-operation";

export const deleteAssets: ModelOperation<{ assetIds: readonly AssetId[] }> = (
  { topology },
  { assetIds },
) => {
  const affectedIds = new Set(assetIds);
  assetIds.forEach((id) => {
    const maybeNodeId = id;
    topology.getLinks(maybeNodeId).forEach((linkId) => {
      affectedIds.add(linkId);
    });
  });
  return { name: "Delete assets", deleteAssets: Array.from(affectedIds) };
};
