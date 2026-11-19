import {
  AllowedFlowDirection,
  anyBarrier,
  getCustomerPointDemands,
  getAllowedFlowDirectionFromAssetConfig,
  getJunctionDemands,
  respectingFlowDirection,
  trace,
  weightedTrace,
  type AllowedFlowDirectionQueries,
  type AssetsMap,
  type AssetId,
  type AssetIndexQueries,
  type Demand,
  type HydraulicModel,
  type TopologyQueries,
  type TraceBarriers,
  type TraceResult,
  type Valve,
} from "@epanet-js/hydraulic-model";

export type TopologyIssues = {
  selfFeedingPumps: AssetId[];
  selfFeedingValves: AssetId[];
  junctionsWithoutSupply: JunctionsWithoutSupply[];
};

export type JunctionsWithoutSupply = {
  junctionIds: AssetId[];
  blockingLinkIds: AssetId[];
};

export const PUMP_FEEDING_ITSELF_RULE_ID = "pump.notFeedingItself" as const;
export const VALVE_FEEDING_ITSELF_RULE_ID = "valve.notFeedingItself" as const;
export const JUNCTION_WITHOUT_SUPPLY_RULE_ID = "junction.supplied" as const;

export type TopologyRuleId =
  | typeof PUMP_FEEDING_ITSELF_RULE_ID
  | typeof VALVE_FEEDING_ITSELF_RULE_ID
  | typeof JUNCTION_WITHOUT_SUPPLY_RULE_ID;

export type TopologyIssue =
  | {
      ruleId:
        | typeof PUMP_FEEDING_ITSELF_RULE_ID
        | typeof VALVE_FEEDING_ITSELF_RULE_ID;
      assetIds: AssetId[];
    }
  | {
      ruleId: typeof JUNCTION_WITHOUT_SUPPLY_RULE_ID;
      assetIds: AssetId[];
      blockingLinkIds: AssetId[];
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

export const listTopologyIssues = (issues: TopologyIssues): TopologyIssue[] => [
  ...issues.selfFeedingPumps.map((pumpId) => ({
    ruleId: PUMP_FEEDING_ITSELF_RULE_ID,
    assetIds: [pumpId],
  })),
  ...issues.selfFeedingValves.map((valveId) => ({
    ruleId: VALVE_FEEDING_ITSELF_RULE_ID,
    assetIds: [valveId],
  })),
  ...issues.junctionsWithoutSupply.map(({ junctionIds, blockingLinkIds }) => ({
    ruleId: JUNCTION_WITHOUT_SUPPLY_RULE_ID,
    assetIds: junctionIds,
    blockingLinkIds,
  })),
];

export function findReturnPath(
  linkId: AssetId,
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
  directions: AllowedFlowDirectionQueries,
): TraceResult | null {
  const [upstreamNodeId, downstreamNodeId] = topology.getNodes(linkId);
  const barriers = followingFlowUntilSources(topology, assetIndex, directions);
  const { distances: linksAway } = weightedTrace(
    { nodeIds: [downstreamNodeId], linkIds: [] },
    topology,
    barriers,
    { maxDistance: Infinity, maxHops: Infinity, lengthOf: () => 1 },
  );
  if (!linksAway.has(upstreamNodeId)) return null;

  const nodeIds = [upstreamNodeId];
  const linkIds: AssetId[] = [];
  let nodeId = upstreamNodeId;

  while (nodeId !== downstreamNodeId) {
    const previous = previousStep(
      nodeId,
      linkId,
      topology,
      barriers,
      linksAway,
    );
    if (previous === null) return null;

    nodeIds.unshift(previous.nodeId);
    linkIds.unshift(previous.linkId);
    nodeId = previous.nodeId;
  }

  return { nodeIds, linkIds };
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

export const topologyFlowDirections = (
  assets: AssetsMap,
): AllowedFlowDirectionQueries => ({
  getAllowedFlowDirection: (linkId) => {
    const asset = assets.get(linkId);
    if (!asset) return AllowedFlowDirection.NONE;
    if (asset.type !== "valve")
      return getAllowedFlowDirectionFromAssetConfig(asset);

    const valve = asset as unknown as Valve;
    if (valve.initialStatus === "closed") return AllowedFlowDirection.NONE;

    return closesOnReverseFlow(valve)
      ? AllowedFlowDirection.DOWNSTREAM
      : AllowedFlowDirection.BOTH;
  },
});

const closesOnReverseFlow = (valve: Valve): boolean =>
  (valve.kind === "prv" || valve.kind === "psv") &&
  valve.initialStatus === "active";

function findSelfFeedingLinks(
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
  directions: AllowedFlowDirectionQueries,
): Pick<TopologyIssues, "selfFeedingPumps" | "selfFeedingValves"> {
  const barriers = followingFlowUntilSources(topology, assetIndex, directions);
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
      barriers,
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
): JunctionsWithoutSupply[] {
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
  const stoppingAtSupplied: TraceBarriers = {
    nodeStopReason: (nodeId) => (supplied.has(nodeId) ? "barrier" : null),
    linkStopReason: () => null,
  };

  const grouped = new Set<AssetId>();
  const groups: JunctionsWithoutSupply[] = [];

  for (const nodeId of connected.nodeIds) {
    if (supplied.has(nodeId) || grouped.has(nodeId)) continue;

    const { nodeIds } = trace(
      { nodeIds: [nodeId], linkIds: [] },
      topology,
      stoppingAtSupplied,
    );
    for (const groupedNodeId of nodeIds) grouped.add(groupedNodeId);

    const junctionIds = nodeIds.filter(
      (groupedNodeId) =>
        assetIndex.getNodeType(groupedNodeId) === "junction" &&
        demands.carriesDemand(groupedNodeId),
    );
    if (junctionIds.length === 0) continue;

    groups.push({
      junctionIds,
      blockingLinkIds: linksFromSupplied(nodeIds, topology, supplied),
    });
  }

  return groups.sort((a, b) => b.junctionIds.length - a.junctionIds.length);
}

const linksFromSupplied = (
  nodeIds: AssetId[],
  topology: TopologyQueries,
  supplied: Set<AssetId>,
): AssetId[] => {
  const linkIds = new Set<AssetId>();

  for (const nodeId of nodeIds) {
    for (const linkId of topology.getLinks(nodeId)) {
      const [startNodeId, endNodeId] = topology.getNodes(linkId);
      const otherNodeId = startNodeId === nodeId ? endNodeId : startNodeId;
      if (supplied.has(otherNodeId)) linkIds.add(linkId);
    }
  }

  return [...linkIds];
};

const previousStep = (
  nodeId: AssetId,
  excludedLinkId: AssetId,
  topology: TopologyQueries,
  barriers: TraceBarriers,
  linksAway: Map<AssetId, number>,
): { nodeId: AssetId; linkId: AssetId } | null => {
  const previousLinksAway = linksAway.get(nodeId)! - 1;

  for (const linkId of topology.getLinks(nodeId)) {
    if (linkId === excludedLinkId) continue;

    const [startNodeId, endNodeId] = topology.getNodes(linkId);
    const previousNodeId = startNodeId === nodeId ? endNodeId : startNodeId;
    if (linksAway.get(previousNodeId) !== previousLinksAway) continue;
    if (barriers.linkStopReason(linkId, previousNodeId) !== null) continue;

    return { nodeId: previousNodeId, linkId };
  }

  return null;
};

const followingFlowUntilSources = (
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
  directions: AllowedFlowDirectionQueries,
): TraceBarriers =>
  respectingFlowDirection(stoppingAtSources(assetIndex), topology, directions);

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
