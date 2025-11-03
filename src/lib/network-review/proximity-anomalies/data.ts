import { AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model";
import { Position } from "geojson";

interface EncodedProximityAnomaly {
  nodeId: number;
  connection: EncodedAlternativeConnection;
}

export type EncodedProximityAnomalies = EncodedProximityAnomaly[];

export interface EncodedAlternativeConnection {
  pipeId: number;
  distance: number;
  nearestPointOnPipe: Position;
}

export interface ProximityAnomaly {
  nodeId: AssetId;
  pipeId: AssetId;
  distance: number;
  nearestPointOnPipe: Position;
}

export function decodeProximityAnomalies(
  model: HydraulicModel,
  nodeIdsLookup: number[],
  linkIdsLookup: number[],
  encodedProximityAnomalies: EncodedProximityAnomaly[],
): ProximityAnomaly[] {
  const proximityAnomalies: ProximityAnomaly[] = [];

  encodedProximityAnomalies.forEach((encoded) => {
    const nodeId = nodeIdsLookup[encoded.nodeId];
    const connection = encoded.connection;
    const pipeId = linkIdsLookup[connection.pipeId];
    const pipeAsset = model.assets.get(pipeId);
    if (pipeAsset && pipeAsset.type === "pipe") {
      proximityAnomalies.push({
        nodeId,
        pipeId,
        distance: connection.distance,
        nearestPointOnPipe: connection.nearestPointOnPipe,
      });
    }
  });

  return proximityAnomalies.sort((a: ProximityAnomaly, b: ProximityAnomaly) => {
    const nodeA = model.assets.get(a.nodeId);
    const nodeB = model.assets.get(b.nodeId);
    const labelA = nodeA ? nodeA.label.toUpperCase() : String(a.nodeId);
    const labelB = nodeB ? nodeB.label.toUpperCase() : String(b.nodeId);

    if (a.distance < b.distance) return -1;
    if (a.distance > b.distance) return 1;
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return 0;
  });
}

export interface Node {
  id: number;
  position: Position;
}

export interface Link {
  id: number;
  startNode: number;
  endNode: number;
}
