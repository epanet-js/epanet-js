import { AssetId, LinkAsset } from "../asset-types";
import { ModelOperation } from "../model-operation";

type ReverseLinkData = {
  linkId: AssetId;
};

export const reverseLink: ModelOperation<ReverseLinkData> = (
  hydraulicModel,
  { linkId },
) => {
  const asset = hydraulicModel.assets.get(linkId);
  if (!asset || asset.isNode) {
    throw new Error(`Link with id ${linkId} not found`);
  }

  const linkAsset = asset as LinkAsset;
  const linkCopy = linkAsset.copy() as LinkAsset;

  const [startNodeId, endNodeId] = linkCopy.connections;
  linkCopy.setConnections(endNodeId, startNodeId);

  const reversedCoordinates = [...linkCopy.coordinates].reverse();
  linkCopy.setCoordinates(reversedCoordinates);

  return {
    note: `Reverse ${linkAsset.type}`,
    putAssets: [linkCopy],
  };
};
