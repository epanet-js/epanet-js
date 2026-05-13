import {
  Asset,
  AssetId,
  AssetsMap,
  LinkAsset,
  Topology,
} from "src/hydraulic-model";
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
  const visited = new Set<AssetId>([anchors[0]]);

  for (let i = 0; i < anchors.length - 1; i++) {
    const segmentStart = anchors[i];
    const segmentEnd = anchors[i + 1];
    const forbidden = new Set(visited);
    forbidden.delete(segmentStart);

    const segment = topology.shortestPath(
      segmentStart,
      segmentEnd,
      weightOf(assets, forbidden),
    );
    if (segment === null) return null;

    for (let j = 1; j < segment.nodeIds.length; j++) {
      const n = segment.nodeIds[j];
      nodeIds.push(n);
      visited.add(n);
    }
    for (const linkId of segment.linkIds) {
      linkIds.push(linkId);
    }
    totalLength += segment.totalLength;
  }

  return { nodeIds, linkIds, totalLength };
};

const weightOf =
  (assets: AssetsMap, forbiddenNodes?: Set<AssetId>) =>
  (linkId: AssetId): number => {
    const link = assets.get(linkId);
    if (!link || !link.isLink) return 0;
    if (isLinkBlocked(link)) return Infinity;
    if (forbiddenNodes && forbiddenNodes.size > 0) {
      const [n1, n2] = (link as LinkAsset).connections;
      if (forbiddenNodes.has(n1) || forbiddenNodes.has(n2)) return Infinity;
    }
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
