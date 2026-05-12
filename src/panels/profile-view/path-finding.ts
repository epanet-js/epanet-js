import { Asset, AssetId, AssetsMap, Topology } from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { ResultsReader } from "src/simulation/results-reader";

export const findProfilePath = (
  topology: Topology,
  assets: AssetsMap,
  startNodeId: AssetId,
  endNodeId: AssetId,
  results: ResultsReader | null,
): PathData | null =>
  topology.shortestPath(startNodeId, endNodeId, weightOf(assets, results));

const weightOf =
  (assets: AssetsMap, results: ResultsReader | null) =>
  (linkId: AssetId): number => {
    const link = assets.get(linkId);
    if (!link || !link.isLink) return 0;
    if (isLinkBlocked(link, results)) return Infinity;
    return Math.max(0, (link as { length: number }).length || 0);
  };

const isLinkBlocked = (link: Asset, results: ResultsReader | null): boolean => {
  if (link.isActive === false) return true;

  switch (link.type) {
    case "pipe": {
      const simStatus = results?.getPipe(link.id)?.status ?? null;
      const initialStatus = (link as unknown as { initialStatus: string })
        .initialStatus;
      return (simStatus ?? initialStatus) === "closed";
    }
    case "pump": {
      const simStatus = results?.getPump(link.id)?.status ?? null;
      const initialStatus = (link as unknown as { initialStatus: string })
        .initialStatus;
      return (simStatus ?? initialStatus) === "off";
    }
    case "valve": {
      const simStatus = results?.getValve(link.id)?.status ?? null;
      if (simStatus !== null) return simStatus === "closed";
      const initialStatus = (link as unknown as { initialStatus: string })
        .initialStatus;
      return initialStatus === "closed";
    }
    default:
      return false;
  }
};
