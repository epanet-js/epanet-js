import { AssetId, AssetsMap } from "src/hydraulic-model";
import { Topology } from "./topology/topology";
import { PathData } from "./topology/types";

export const shortestPath = (
  topology: Topology,
  assets: AssetsMap,
  startNodeId: AssetId,
  endNodeId: AssetId,
): PathData | null =>
  topology.shortestPath(startNodeId, endNodeId, byLinkLength(assets));

export const byLinkLength =
  (assets: AssetsMap) =>
  (linkId: AssetId): number => {
    const link = assets.get(linkId);
    if (link && link.isLink) {
      return Math.max(0, (link as { length: number }).length || 0);
    }
    return 0;
  };
