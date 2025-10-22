import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { SubNetwork } from "./data";
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
