import { Asset, AssetId, AssetsMap, Topology } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";

export const findProfilePath = (
  topology: Topology,
  assets: AssetsMap,
  startNodeId: AssetId,
  endNodeId: AssetId,
): PathData | null =>
  topology.shortestPath(startNodeId, endNodeId, weightOf(assets));

export const deriveProfilePath = (
  topology: Topology,
  assets: AssetsMap,
  anchors: AssetId[],
): PathData | null => {
  if (anchors.length < 2) return null;
  for (const id of anchors) {
    if (!assets.get(id)) return null;
  }

  const nodeIds: AssetId[] = [anchors[0]];
  const linkIds: AssetId[] = [];
  let totalLength = 0;

  for (let i = 0; i < anchors.length - 1; i++) {
    const segment = findProfilePath(
      topology,
      assets,
      anchors[i],
      anchors[i + 1],
    );
    if (segment === null) return null;
    for (let j = 1; j < segment.nodeIds.length; j++) {
      nodeIds.push(segment.nodeIds[j]);
    }
    for (const linkId of segment.linkIds) {
      linkIds.push(linkId);
    }
    totalLength += segment.totalLength;
  }

  return { nodeIds, linkIds, totalLength };
};

const weightOf =
  (assets: AssetsMap) =>
  (linkId: AssetId): number => {
    const link = assets.get(linkId);
    if (!link || !link.isLink) return 0;
    if (isLinkBlocked(link)) return Infinity;
    return Math.max(0, (link as { length: number }).length || 0);
  };

const isLinkBlocked = (link: Asset): boolean => {
  if (link.isActive === false) return true;

  const initialStatus = (link as unknown as { initialStatus: string })
    .initialStatus;

  switch (link.type) {
    case "pipe":
      return initialStatus === "closed";
    case "pump":
      return initialStatus === "off";
    case "valve":
      return initialStatus === "closed";
    default:
      return false;
  }
};
