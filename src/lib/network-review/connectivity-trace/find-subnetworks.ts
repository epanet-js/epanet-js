import { EncodedSubNetwork } from "./data";
import {
  HydraulicModelBuffers,
  HydraulicModelBuffersView,
  toNodeType,
} from "../shared";
import { NodeType } from "src/hydraulic-model";

export function findSubNetworks(
  buffers: HydraulicModelBuffers,
): EncodedSubNetwork[] {
  const views = new HydraulicModelBuffersView(buffers);
  const visited = new Set<number>();
  const subNetworks: EncodedSubNetwork[] = [];
  let subnetworkId = 0;

  for (let nodeId = 0; nodeId < views.nodeConnections.count; nodeId++) {
    if (visited.has(nodeId)) continue;

    const subnetwork = traverseSubNetwork(
      nodeId,
      subnetworkId++,
      visited,
      views,
    );

    if (shouldIncludeSubNetwork(subnetwork)) {
      subNetworks.push(subnetwork);
    }
  }

  return sortSubNetworksBySize(subNetworks);
}

function traverseSubNetwork(
  startNodeId: number,
  subnetworkId: number,
  visited: Set<number>,
  views: HydraulicModelBuffersView,
): EncodedSubNetwork {
  const subNetwork: EncodedSubNetwork = {
    subnetworkId,
    nodeIndices: [],
    linkIndices: [],
    supplySourceCount: 0,
    pipeCount: 0,
    bounds: [Infinity, Infinity, -Infinity, -Infinity],
  };

  const visitedLinks = new Set<number>();
  const stack: number[] = [startNodeId];

  while (stack.length > 0) {
    const currentNodeId = stack.pop()!;
    if (visited.has(currentNodeId)) continue;

    processNode(currentNodeId, visited, views, subNetwork);

    const linkIds = views.nodeConnections.getById(currentNodeId) || [];
    for (const linkId of linkIds) {
      if (visitedLinks.has(linkId)) continue;

      const neighborId = processLink(
        linkId,
        currentNodeId,
        visitedLinks,
        views,
        subNetwork,
      );

      if (!visited.has(neighborId)) {
        stack.push(neighborId);
      }
    }
  }

  return subNetwork;
}

function processNode(
  nodeId: number,
  visited: Set<number>,
  views: HydraulicModelBuffersView,
  subNetwork: EncodedSubNetwork,
): void {
  visited.add(nodeId);
  subNetwork.nodeIndices.push(nodeId);

  const nodeType = toNodeType(views.nodeTypes.getById(nodeId) ?? 0);
  if (isSupplySource(nodeType)) {
    subNetwork.supplySourceCount++;
  }
}

function processLink(
  linkId: number,
  currentNodeId: number,
  visitedLinks: Set<number>,
  views: HydraulicModelBuffersView,
  subNetwork: EncodedSubNetwork,
): number {
  visitedLinks.add(linkId);

  const linkTypeId = views.linkTypes.getById(linkId) ?? 0;
  if (isPipe(linkTypeId)) {
    subNetwork.pipeCount++;
  }

  subNetwork.linkIndices.push(linkId);

  const bounds = views.linkBounds.getById(linkId);
  if (bounds) {
    subNetwork.bounds = expandBounds(subNetwork.bounds, bounds);
  }

  const linkConnections = views.linksConnections.getById(linkId);
  return getNeighborNode(linkConnections, currentNodeId);
}

function isSupplySource(nodeType: NodeType): boolean {
  return nodeType === "reservoir" || nodeType === "tank";
}

function isPipe(linkTypeId: number): boolean {
  return linkTypeId === 0;
}

function expandBounds(
  currentBounds: [number, number, number, number],
  newBounds: [number, number, number, number],
): [number, number, number, number] {
  const [minX, minY, maxX, maxY] = newBounds;
  return [
    Math.min(currentBounds[0], minX),
    Math.min(currentBounds[1], minY),
    Math.max(currentBounds[2], maxX),
    Math.max(currentBounds[3], maxY),
  ];
}

function getNeighborNode(
  linkConnections: [number, number],
  currentNodeId: number,
): number {
  return linkConnections[0] === currentNodeId
    ? linkConnections[1]
    : linkConnections[0];
}

function shouldIncludeSubNetwork(subNetwork: EncodedSubNetwork): boolean {
  return subNetwork.nodeIndices.length > 1;
}

function sortSubNetworksBySize(
  subNetworks: EncodedSubNetwork[],
): EncodedSubNetwork[] {
  return subNetworks.sort(
    (a, b) => b.nodeIndices.length - a.nodeIndices.length,
  );
}
