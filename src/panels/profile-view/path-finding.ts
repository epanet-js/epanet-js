import { Asset, AssetId, AssetsMap, Topology } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { ResultsReader } from "src/simulation/results-reader";

export const shortestPathByDistance = (
  topology: Topology,
  assets: AssetsMap,
  startNodeId: AssetId,
  endNodeId: AssetId,
): PathData | null =>
  topology.shortestPath(startNodeId, endNodeId, byLinkLength(assets));

export const shortestPathByFlow = (
  topology: Topology,
  assets: AssetsMap,
  results: ResultsReader,
  startNodeId: AssetId,
  endNodeId: AssetId,
): PathData | null =>
  topology.shortestPath(startNodeId, endNodeId, byInverseFlow(assets, results));

const FLOW_EPSILON = 1e-9;

const byLinkLength =
  (assets: AssetsMap) =>
  (linkId: AssetId): number => {
    const link = assets.get(linkId);
    if (link && link.isLink) {
      return Math.max(0, (link as { length: number }).length || 0);
    }
    return 0;
  };

const byInverseFlow =
  (assets: AssetsMap, results: ResultsReader) =>
  (linkId: AssetId): number => {
    const link = assets.get(linkId);
    if (!link || !link.isLink) return 0;

    const flow = readLinkFlow(results, link);
    if (flow === null) return 1 / FLOW_EPSILON;

    return 1 / Math.max(Math.abs(flow), FLOW_EPSILON);
  };

const readLinkFlow = (results: ResultsReader, link: Asset): number | null => {
  switch (link.type) {
    case "pipe":
      return results.getPipe(link.id)?.flow ?? null;
    case "pump":
      return results.getPump(link.id)?.flow ?? null;
    case "valve":
      return results.getValve(link.id)?.flow ?? null;
    default:
      return null;
  }
};
