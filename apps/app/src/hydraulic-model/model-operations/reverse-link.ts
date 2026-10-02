import { AssetId, LinkAsset } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { changeSet, putAssets } from "../change-sets";

type ReverseLinkData = {
  linkId: AssetId;
};

export const reverseLink: ModelOperation<ReverseLinkData> = (
  hydraulicModel,
  { linkId },
) => {
  const linkCopy = buildReversedLink(hydraulicModel, linkId);

  return changeSet(hydraulicModel, "reverseLink", [putAssets([linkCopy])]);
};

export const reverseLinkDeprecated: ModelOperationDeprecated<
  ReverseLinkData
> = (hydraulicModel, { linkId }) => {
  const linkCopy = buildReversedLink(hydraulicModel, linkId);

  return {
    note: "reverseLink",
    putAssets: [linkCopy],
  };
};

const buildReversedLink = (
  hydraulicModel: HydraulicModel,
  linkId: AssetId,
): LinkAsset => {
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

  return linkCopy;
};
