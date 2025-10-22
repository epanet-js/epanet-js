import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { Subnetwork, SUBNETWORK_COLORS } from "./data";
import bbox from "@turf/bbox";
import { lineString } from "@turf/helpers";
import { BBox2d } from "@turf/helpers/dist/js/lib/geojson";

interface Component {
  nodeIds: AssetId[];
  linkIds: AssetId[];
  hasTanks: boolean;
  hasReservoirs: boolean;
  coordinates: [number, number][];
}

export function findSubNetworks(model: HydraulicModel): Subnetwork[] {
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
      hasTanks: false,
      hasReservoirs: false,
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

      if (currentAsset.type === "tank") {
        component.hasTanks = true;
      } else if (currentAsset.type === "reservoir") {
        component.hasReservoirs = true;
      }

      const geometry = currentAsset.feature.geometry as GeoJSON.Point;
      component.coordinates.push(geometry.coordinates as [number, number]);

      const linkIds = model.topology.getLinks(current);
      for (const linkId of linkIds) {
        const link = model.assets.get(linkId);
        if (link && link.isLink && "connections" in link) {
          const [startId, endId] = link.connections;
          const neighborId = startId === current ? endId : startId;

          if (!visited.has(neighborId)) {
            stack.push(neighborId);
            component.linkIds.push(linkId);
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

function buildSubnetworks(components: Component[]): Subnetwork[] {
  return components.map((component, idx) => {
    const bounds = calculateBounds(component.coordinates);

    const hasSupplySource = component.hasTanks || component.hasReservoirs;
    const supplySourceTypes: string[] = [];
    if (component.hasReservoirs) supplySourceTypes.push("reservoir");
    if (component.hasTanks) supplySourceTypes.push("tank");

    return {
      subnetworkId: idx,
      nodeIds: component.nodeIds,
      linkIds: component.linkIds,
      hasSupplySource,
      supplySourceTypes,
      bounds,
      color: SUBNETWORK_COLORS[idx % SUBNETWORK_COLORS.length],
    };
  });
}

const calculateBounds = (coordinates: [number, number][]): BBox2d =>
  bbox(lineString(coordinates)) as BBox2d;
