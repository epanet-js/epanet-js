import { AssetId, HydraulicModel } from "src/hydraulic-model";
import {
  SubNetwork,
  RunData,
  EncodedSubNetworks,
  HydraulicModelBufferViewForSubnetworks,
} from "./data";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import { BBox2d } from "@turf/helpers/dist/js/lib/geojson";

interface Component {
  nodeIds: AssetId[];
  linkIds: AssetId[];
  supplySourceCount: number;
  pipeCount: number;
  coordinates: [number, number][][];
}

export function findSubNetworks(model: HydraulicModel): SubNetwork[] {
  const components = findConnectedComponentsUsingTopology(model);
  const subnetworks = buildSubnetworks(components);

  return subnetworks.sort((a, b) => b.nodeIds.length - a.nodeIds.length);
}

export function findSubNetworksFromBuffers(input: RunData): EncodedSubNetworks {
  const data = new HydraulicModelBufferViewForSubnetworks(
    input.nodeBuffer,
    input.linkBuffer,
  );

  const adjacency = new Map<number, number[]>();
  const linkConnections = new Map<number, [number, number]>();

  for (const link of data.links()) {
    if (!adjacency.has(link.startNode)) adjacency.set(link.startNode, []);
    if (!adjacency.has(link.endNode)) adjacency.set(link.endNode, []);
    adjacency.get(link.startNode)!.push(link.id);
    adjacency.get(link.endNode)!.push(link.id);
    linkConnections.set(link.id, [link.startNode, link.endNode]);
  }

  const nodeTypes = new Map<number, number>();
  for (const node of data.nodes()) {
    nodeTypes.set(node.id, node.nodeType);
    if (!adjacency.has(node.id)) {
      adjacency.set(node.id, []);
    }
  }

  const linkTypes = new Map<number, number>();
  const linkBounds = new Map<number, [number, number, number, number]>();
  for (const link of data.links()) {
    linkTypes.set(link.id, link.linkType);
    linkBounds.set(link.id, link.bounds);
  }

  const visited = new Set<number>();
  const components: EncodedSubNetworks["subnetworks"] = [];
  let subnetworkId = 0;

  for (const [nodeId] of nodeTypes) {
    if (visited.has(nodeId)) continue;

    const component = {
      subnetworkId: subnetworkId++,
      nodeIndices: [] as number[],
      linkIndices: [] as number[],
      supplySourceCount: 0,
      pipeCount: 0,
      bounds: [Infinity, Infinity, -Infinity, -Infinity] as [
        number,
        number,
        number,
        number,
      ],
    };

    const visitedLinks = new Set<number>();
    const stack: number[] = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;

      visited.add(current);
      component.nodeIndices.push(current);

      const nodeType = nodeTypes.get(current)!;
      if (nodeType === 1 || nodeType === 2) {
        component.supplySourceCount++;
      }

      const linkIds = adjacency.get(current) || [];
      for (const linkId of linkIds) {
        if (visitedLinks.has(linkId)) continue;

        visitedLinks.add(linkId);
        const linkType = linkTypes.get(linkId)!;
        if (linkType === 0) {
          component.pipeCount++;
        }

        component.linkIndices.push(linkId);

        const [minX, minY, maxX, maxY] = linkBounds.get(linkId)!;
        component.bounds[0] = Math.min(component.bounds[0], minX);
        component.bounds[1] = Math.min(component.bounds[1], minY);
        component.bounds[2] = Math.max(component.bounds[2], maxX);
        component.bounds[3] = Math.max(component.bounds[3], maxY);

        const [startNode, endNode] = linkConnections.get(linkId)!;
        const neighborId = startNode === current ? endNode : startNode;

        if (!visited.has(neighborId)) {
          stack.push(neighborId);
        }
      }
    }

    if (component.nodeIndices.length > 1) {
      components.push(component);
    }
  }

  components.sort((a, b) => b.nodeIndices.length - a.nodeIndices.length);

  return { subnetworks: components };
}

function findConnectedComponentsUsingTopology(
  model: HydraulicModel,
): Component[] {
  const visited = new Set<AssetId>();
  const components: Component[] = [];

  for (const [nodeId, asset] of model.assets) {
    if (!asset.isNode || visited.has(nodeId)) continue;

    const component: Component = {
      nodeIds: [],
      linkIds: [],
      supplySourceCount: 0,
      pipeCount: 0,
      coordinates: [],
    };

    const stack: AssetId[] = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) continue;

      visited.add(current);

      const currentAsset = model.assets.get(current);
      if (!currentAsset?.isNode) continue;

      component.nodeIds.push(current);

      if (currentAsset.type === "tank" || currentAsset.type === "reservoir") {
        component.supplySourceCount++;
      }

      const linkIds = model.topology.getLinks(current);
      for (const linkId of linkIds) {
        const link = model.assets.get(linkId);
        if (link && link.isLink && "connections" in link) {
          const [startId, endId] = link.connections;
          const neighborId = startId === current ? endId : startId;

          if (!visited.has(neighborId)) {
            stack.push(neighborId);
            component.linkIds.push(linkId);
            component.coordinates.push(
              link.feature.geometry.coordinates as [number, number][],
            );
            if (link.type === "pipe") {
              component.pipeCount++;
            }
          }
        }
      }
    }

    if (component.nodeIds.length > 1) {
      components.push(component);
    }
  }

  return components;
}

function buildSubnetworks(components: Component[]): SubNetwork[] {
  return components.map((component, idx) => {
    const bounds = calculateBounds(component.coordinates);

    return {
      subnetworkId: idx,
      nodeIds: component.nodeIds,
      linkIds: component.linkIds,
      supplySourceCount: component.supplySourceCount,
      pipeCount: component.pipeCount,
      bounds,
    };
  });
}

const calculateBounds = (coordinates: [number, number][][]): BBox2d =>
  bbox(lineString(coordinates.flat())) as BBox2d;
