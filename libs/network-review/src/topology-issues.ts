import {
  AllowedFlowDirection,
  anyBarrier,
  getCustomerPointDemands,
  getJunctionDemands,
  respectingFlowDirection,
  trace,
  type AllowedFlowDirectionQueries,
  type AssetId,
  type AssetIndexQueries,
  type Demand,
  type HydraulicModel,
  type TopologyQueries,
  type TraceBarriers,
} from "@epanet-js/hydraulic-model";

export type TopologyIssues = {
  selfFeedingPumps: AssetId[];
  selfFeedingValves: AssetId[];
  junctionsWithoutSupply: AssetId[];
};

export interface JunctionDemandQueries {
  carriesDemand(junctionId: AssetId): boolean;
}

export function findTopologyIssues(
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
  directions: AllowedFlowDirectionQueries,
  demands: JunctionDemandQueries,
): TopologyIssues {
  const junctionsWithoutSupply = findJunctionsWithoutSupply(
    topology,
    assetIndex,
    directions,
    demands,
  );

  const { selfFeedingPumps, selfFeedingValves } = findSelfFeedingLinks(
    topology,
    assetIndex,
    directions,
  );

  return {
    selfFeedingPumps,
    selfFeedingValves,
    junctionsWithoutSupply,
  };
}

export const configuredJunctionDemands = (
  model: HydraulicModel,
): JunctionDemandQueries => ({
  carriesDemand: (junctionId) => {
    const { demands, customerPointsLookup } = model;
    if (hasPositiveDemand(getJunctionDemands(demands, junctionId))) return true;

    for (const customerPoint of customerPointsLookup.getCustomerPoints(
      junctionId,
    )) {
      if (hasPositiveDemand(getCustomerPointDemands(demands, customerPoint.id)))
        return true;
    }
    return false;
  },
});

function findSelfFeedingLinks(
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
  directions: AllowedFlowDirectionQueries,
): Pick<TopologyIssues, "selfFeedingPumps" | "selfFeedingValves"> {
  const followingFlowUntilSources = respectingFlowDirection(
    stoppingAtSources(assetIndex),
    topology,
    directions,
  );
  const selfFeedingPumps: AssetId[] = [];
  const selfFeedingValves: AssetId[] = [];

  for (const [linkId] of assetIndex.iterateLinks()) {
    const linkType = assetIndex.getLinkType(linkId);
    if (linkType !== "pump" && linkType !== "valve") continue;
    if (
      directions.getAllowedFlowDirection(linkId) !==
      AllowedFlowDirection.DOWNSTREAM
    )
      continue;

    const [inletNodeId, outletNodeId] = topology.getNodes(linkId);
    if (inletNodeId === outletNodeId) continue;

    const { nodeIds } = trace(
      { nodeIds: [outletNodeId], linkIds: [] },
      topology,
      followingFlowUntilSources,
    );
    if (!nodeIds.includes(inletNodeId)) continue;

    if (linkType === "pump") selfFeedingPumps.push(linkId);
    else selfFeedingValves.push(linkId);
  }

  return { selfFeedingPumps, selfFeedingValves };
}

function findJunctionsWithoutSupply(
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
  directions: AllowedFlowDirectionQueries,
  demands: JunctionDemandQueries,
): AssetId[] {
  const sourceIds: AssetId[] = [];
  for (const [nodeId] of assetIndex.iterateNodes()) {
    if (isSource(assetIndex, nodeId)) sourceIds.push(nodeId);
  }
  if (sourceIds.length === 0) return [];

  const fromSources = { nodeIds: sourceIds, linkIds: [] };
  const connected = trace(fromSources, topology, anyBarrier());
  const supplied = new Set(
    trace(
      fromSources,
      topology,
      respectingFlowDirection(anyBarrier(), topology, directions),
    ).nodeIds,
  );

  return connected.nodeIds.filter(
    (nodeId) =>
      assetIndex.getNodeType(nodeId) === "junction" &&
      !supplied.has(nodeId) &&
      demands.carriesDemand(nodeId),
  );
}

const stoppingAtSources = (assetIndex: AssetIndexQueries): TraceBarriers => ({
  nodeStopReason: (nodeId) => (isSource(assetIndex, nodeId) ? "barrier" : null),
  linkStopReason: () => null,
});

const isSource = (assetIndex: AssetIndexQueries, nodeId: AssetId): boolean => {
  const nodeType = assetIndex.getNodeType(nodeId);
  return nodeType === "tank" || nodeType === "reservoir";
};

const hasPositiveDemand = (demands: Demand[]): boolean =>
  demands.some((demand) => demand.baseDemand > 0);
