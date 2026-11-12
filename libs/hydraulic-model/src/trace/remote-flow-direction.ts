import { AssetId } from "../asset-types";
import type { HydraulicModel } from "../hydraulic-model";
import { getAllowedFlowDirectionFromAssetConfig } from "./allowed-flow-direction";
import { boundaryBarriers } from "./barriers";
import { trace } from "./trace";
import { AllowedFlowDirection, AllowedFlowDirectionQueries } from "./types";

export const remoteFlowDirectionOf = (
  hydraulicModel: HydraulicModel,
  pumpId: AssetId,
  linkId: AssetId,
): 1 | -1 => {
  if (pumpId === linkId) return 1;

  const [upstreamNodeId, downstreamNodeId] =
    hydraulicModel.topology.getNodes(pumpId);
  const [linkStartId, linkEndId] = hydraulicModel.topology.getNodes(linkId);

  const reachedEnd = (fromNodeId: AssetId) => {
    const start = { nodeIds: [fromNodeId], linkIds: [] };
    const directions = alongActiveLinksExcept(hydraulicModel, linkId);
    const { nodeIds } = trace(
      start,
      hydraulicModel.topology,
      boundaryBarriers(
        hydraulicModel.topology,
        hydraulicModel.assetIndex,
        directions,
      ),
    );
    const reached = new Set(nodeIds);
    if (reached.has(linkStartId) === reached.has(linkEndId)) return null;
    return reached.has(linkStartId) ? "start" : "end";
  };

  const fromDownstream = reachedEnd(downstreamNodeId);
  if (fromDownstream !== null) return fromDownstream === "start" ? 1 : -1;

  const fromUpstream = reachedEnd(upstreamNodeId);
  if (fromUpstream !== null) return fromUpstream === "end" ? 1 : -1;

  return 1;
};

const alongActiveLinksExcept = (
  hydraulicModel: HydraulicModel,
  excludedLinkId: AssetId,
): AllowedFlowDirectionQueries => ({
  getAllowedFlowDirection: (linkId) => {
    if (linkId === excludedLinkId) return AllowedFlowDirection.NONE;
    const asset = hydraulicModel.assets.get(linkId);
    return asset && asset.isActive
      ? getAllowedFlowDirectionFromAssetConfig(asset)
      : AllowedFlowDirection.NONE;
  },
});
