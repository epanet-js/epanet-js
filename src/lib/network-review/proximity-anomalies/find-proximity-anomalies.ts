import {
  EncodedProximityAnomalies,
  Node,
  EncodedAlternativeConnection,
} from "./data";
import {
  HydraulicModelBuffers,
  HydraulicModelBuffersView,
} from "../hydraulic-model-buffers";
import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import { Position } from "geojson";

export function findProximityAnomalies(
  buffers: HydraulicModelBuffers,
  distanceInMeters: number = 0.5,
  connectedJunctionTolerance: number = 0.1,
): EncodedProximityAnomalies {
  const views = new HydraulicModelBuffersView(buffers);

  const results: EncodedProximityAnomalies = [];

  for (const [nodeId, position] of views.nodePositions.enumerate()) {
    const node: Node = { id: nodeId, position };
    const connectedLinkIds = views.nodeConnections.getById(node.id) ?? [];

    if (connectedLinkIds.length === 0) {
      continue;
    }

    const candidateConnectionSegments = findCandidateConnectionSegments(
      node,
      views,
      distanceInMeters,
    );

    const connectedNodeIds = getConnectedNodes(
      connectedLinkIds,
      node.id,
      views,
    );

    const alternativeConnection = findBestAlternativeConnection(
      node,
      candidateConnectionSegments,
      views,
      connectedLinkIds,
      connectedNodeIds,
      distanceInMeters,
      connectedJunctionTolerance,
    );

    if (alternativeConnection) {
      results.push({
        nodeId: node.id,
        connection: alternativeConnection,
      });
    }
  }

  return results;
}

function getConnectedNodes(
  connectedLinkIds: number[],
  nodeId: number,
  views: HydraulicModelBuffersView,
): number[] {
  const connectedNodes: number[] = [];

  for (const linkId of connectedLinkIds) {
    const [startNode, endNode] = views.linksConnections.getById(linkId);

    if (startNode === nodeId) {
      connectedNodes.push(endNode);
    } else if (endNode === nodeId) {
      connectedNodes.push(startNode);
    }
  }

  return connectedNodes;
}

const LAT_DEGREE_IN_METERS_AT_EQUATOR = 111320;
const MIN_SEARCH_RADIUS_IN_METERS = 0.1;

function findCandidateConnectionSegments(
  node: Node,
  views: HydraulicModelBuffersView,
  distanceInMeters: number,
): number[] {
  const [lon, lat] = node.position;
  const searchRadius = Math.max(distanceInMeters, MIN_SEARCH_RADIUS_IN_METERS);
  const deltaLat = searchRadius / LAT_DEGREE_IN_METERS_AT_EQUATOR;
  const deltaLng =
    searchRadius /
    (LAT_DEGREE_IN_METERS_AT_EQUATOR * Math.cos((lat * Math.PI) / 180));

  const candidateSegmentIds = views.pipeSegmentsGeoIndex.search(
    lon - deltaLng,
    lat - deltaLat,
    lon + deltaLng,
    lat + deltaLat,
  );

  return candidateSegmentIds;
}

function findNearestPointOnSegment(
  node: Node,
  segmentIndex: number,
  views: HydraulicModelBuffersView,
): { position: Position; distance: number } {
  const segment = views.pipeSegmentCoordinates.getById(segmentIndex);
  const lineGeom = lineString(segment);
  const nearest = nearestPointOnLine(lineGeom, node.position, {
    units: "meters",
  });

  return {
    position: nearest.geometry.coordinates,
    distance: nearest?.properties?.dist ?? Infinity,
  };
}

function findBestAlternativeConnection(
  node: Node,
  candidateConnectionSegments: number[],
  views: HydraulicModelBuffersView,
  alreadyConnectedLinks: number[],
  connectedNodes: number[],
  distanceInMeters: number,
  connectedJunctionTolerance: number = 0.1,
) {
  const validCandidates: EncodedAlternativeConnection[] = [];
  const alreadyConnectedLinksSet = new Set(alreadyConnectedLinks);

  for (const candidateSegment of candidateConnectionSegments) {
    const pipeId = views.pipeSegmentIds.getById(candidateSegment);
    if (alreadyConnectedLinksSet.has(pipeId)) continue;

    const nearestPoint = findNearestPointOnSegment(
      node,
      candidateSegment,
      views,
    );
    if (nearestPoint.distance > distanceInMeters) continue;

    if (
      isTooCloseToConnectedJunctions(
        nearestPoint.position,
        connectedNodes,
        views,
        connectedJunctionTolerance,
      )
    )
      continue;

    validCandidates.push({
      pipeId,
      distance: nearestPoint.distance,
      nearestPointOnPipe: nearestPoint.position,
    });
  }

  if (validCandidates.length === 0) return null;

  return validCandidates.sort((a, b) => a.distance - b.distance)[0];
}

function isTooCloseToConnectedJunctions(
  nearestPoint: Position,
  connectedNodeIds: number[],
  views: HydraulicModelBuffersView,
  tolerance: number = 0.1,
): boolean {
  for (const connectedNodeId of connectedNodeIds) {
    const connectedNodePosition = views.nodePositions.getById(connectedNodeId);
    if (!connectedNodePosition) continue;

    const dist = distance(point(nearestPoint), point(connectedNodePosition), {
      units: "meters",
    });
    if (dist < tolerance) {
      return true;
    }
  }

  return false;
}
