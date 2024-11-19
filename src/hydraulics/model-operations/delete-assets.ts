import { AssetId } from "../asset-types";
import { ModelOperation } from "../model-operation";

type InputData = {
  assetIds: readonly AssetId[];
};

export const deleteAssets: ModelOperation<InputData> = (
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

  return { note: "Delete assets", deleteAssets: Array.from(affectedIds) };
};
