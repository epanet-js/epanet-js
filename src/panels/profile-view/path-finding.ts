import {
  Asset,
  AssetId,
  AssetsMap,
  LinkAsset,
  Topology,
} from "src/hydraulic-model";
import { PathData } from "src/hydraulic-model/topology/types";
import { ResultsReader } from "src/simulation/results-reader";

export type DeriveProfilePathOptions = {
  ignoreStatus?: boolean;
};

export const findProfilePath = (
  topology: Topology,
  assets: AssetsMap,
  startNodeId: AssetId,
  endNodeId: AssetId,
  results: ResultsReader | null = null,
  options: DeriveProfilePathOptions = {},
): PathData | null =>
  topology.shortestPath(
    startNodeId,
    endNodeId,
    weightOf(assets, results, undefined, options.ignoreStatus ?? false),
  );

export const deriveProfilePath = (
  topology: Topology,
  assets: AssetsMap,
  anchors: AssetId[],
  results: ResultsReader | null = null,
  options: DeriveProfilePathOptions = {},
): PathData | null => {
  if (anchors.length < 2) return null;
  for (const id of anchors) {
    if (!assets.get(id)) return null;
  }

  const ignoreStatus = options.ignoreStatus ?? false;
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
      weightOf(assets, results, forbidden, ignoreStatus),
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

const FLOW_EPSILON = 1e-9;

const weightOf =
  (
    assets: AssetsMap,
    results: ResultsReader | null,
    forbiddenNodes: Set<AssetId> | undefined,
    ignoreStatus: boolean,
  ) =>
  (linkId: AssetId): number => {
    const link = assets.get(linkId);
    if (!link || !link.isLink) return 0;
    if (isLinkBlocked(link, results, ignoreStatus)) return Infinity;
    if (forbiddenNodes && forbiddenNodes.size > 0) {
      const [n1, n2] = (link as LinkAsset).connections;
      if (forbiddenNodes.has(n1) || forbiddenNodes.has(n2)) return Infinity;
    }
    if (results) {
      const flow = readLinkFlow(results, link);
      if (flow === null) return 1 / FLOW_EPSILON;
      return 1 / Math.max(Math.abs(flow), FLOW_EPSILON);
    }
    return Math.max(0, (link as { length: number }).length || 0);
  };

const isLinkBlocked = (
  link: Asset,
  results: ResultsReader | null,
  ignoreStatus: boolean,
): boolean => {
  if (link.isActive === false) return true;
  if (ignoreStatus) return false;

  const simStatus = results ? readLinkSimStatus(results, link) : null;
  if (simStatus !== null) {
    return simStatus === "closed" || simStatus === "off";
  }

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

const readLinkSimStatus = (
  results: ResultsReader,
  link: Asset,
): string | null => {
  switch (link.type) {
    case "pipe":
      return results.getPipe(link.id)?.status ?? null;
    case "pump":
      return results.getPump(link.id)?.status ?? null;
    case "valve":
      return results.getValve(link.id)?.status ?? null;
    default:
      return null;
  }
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
