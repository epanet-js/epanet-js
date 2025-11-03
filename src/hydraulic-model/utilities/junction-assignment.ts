import { Position } from "geojson";
import turfDistance from "@turf/distance";
import { AssetId } from "../asset-types/base-asset";

export type NodeForJunctionAssignment = {
  id: AssetId;
  type: string;
  coordinates: Position;
};

export const findJunctionForCustomerPoint = (
  startNode: NodeForJunctionAssignment,
  endNode: NodeForJunctionAssignment,
  snapPoint: Position,
): AssetId | null => {
  const junctionNodes = [];

  if (startNode.type === "junction") {
    junctionNodes.push({
      nodeId: startNode.id,
      coordinates: startNode.coordinates,
    });
  }

  if (endNode.type === "junction") {
    junctionNodes.push({
      nodeId: endNode.id,
      coordinates: endNode.coordinates,
    });
  }

  if (junctionNodes.length === 0) {
    return null;
  }

  if (junctionNodes.length === 1) {
    return junctionNodes[0].nodeId;
  }

  const junctionDistances = junctionNodes.map((junction) => ({
    junction,
    distance: turfDistance(snapPoint, junction.coordinates, {
      units: "meters",
    }),
  }));

  junctionDistances.sort((a, b) => a.distance - b.distance);
  return junctionDistances[0].junction.nodeId;
};
