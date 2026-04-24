import { AssetId, AssetsMap } from "src/hydraulic-model";
import { Topology } from "./topology/topology";
import { PathData } from "src/state/profile-view";

const MAX_PATHS = 3;
const MAX_DEPTH = 200;

export function findPaths(
  topology: Topology,
  assets: AssetsMap,
  startNodeId: AssetId,
  endNodeId: AssetId,
): PathData[] {
  if (startNodeId === endNodeId) return [];

  const found: PathData[] = [];

  // Iterative DFS: each stack entry is [currentNodeId, visitedNodes, nodeIds, linkIds]
  const stack: [AssetId, Set<AssetId>, AssetId[], AssetId[]][] = [
    [startNodeId, new Set([startNodeId]), [startNodeId], []],
  ];

  while (stack.length > 0 && found.length < MAX_PATHS) {
    const entry = stack.pop();
    if (!entry) break;
    const [nodeId, visited, nodeIds, linkIds] = entry;

    if (nodeIds.length > MAX_DEPTH) continue;

    const linkAssetIds = topology.getLinks(nodeId);
    for (const linkId of linkAssetIds) {
      const [n1, n2] = topology.getNodes(linkId);
      const nextNodeId = n1 === nodeId ? n2 : n1;

      if (nextNodeId === endNodeId) {
        const finalNodeIds = [...nodeIds, endNodeId];
        const finalLinkIds = [...linkIds, linkId];
        found.push(buildPathData(finalNodeIds, finalLinkIds, assets));
        continue;
      }

      if (!visited.has(nextNodeId)) {
        const newVisited = new Set(visited);
        newVisited.add(nextNodeId);
        stack.push([
          nextNodeId,
          newVisited,
          [...nodeIds, nextNodeId],
          [...linkIds, linkId],
        ]);
      }
    }
  }

  // Sort by total hydraulic length ascending (shortest = primary)
  found.sort((a, b) => a.totalLength - b.totalLength);

  return found;
}

function buildPathData(
  nodeIds: AssetId[],
  linkIds: AssetId[],
  assets: AssetsMap,
): PathData {
  let totalLength = 0;
  for (const linkId of linkIds) {
    const link = assets.get(linkId);
    if (link && link.isLink) {
      totalLength += (link as { length: number }).length;
    }
  }
  return { nodeIds, linkIds, totalLength };
}
