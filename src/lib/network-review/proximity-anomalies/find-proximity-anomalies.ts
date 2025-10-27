import Flatbush from "flatbush";
import {
  EncodedProximityAnomalies,
  RunData,
  Node,
  EncodedAlternativeConnection,
} from "./data";
import {
  FixedSizeBufferView,
  VariableSizeBufferView,
  EncodedSize,
  decodePosition,
  decodeId,
  decodeLinkConnections,
  decodeLineCoordinates,
  decodeIdsList,
} from "../shared";
import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import { Position } from "geojson";

export function findProximityAnomalies(
  input: RunData,
  distanceInMeters: number = 0.5,
  connectedJunctionTolerance: number = 0.1,
): EncodedProximityAnomalies {
  const nodePositionsView = new FixedSizeBufferView<Position>(
    input.nodePositions,
    EncodedSize.position,
    decodePosition,
  );
  const nodeConnectionsView = new VariableSizeBufferView(
    input.nodeConnections,
    decodeIdsList,
  );
  const linkConnectionsView = new FixedSizeBufferView(
    input.linksConnections,
    EncodedSize.id * 2,
    decodeLinkConnections,
  );
  const pipeSegmentsGeoIndex = Flatbush.from(input.pipeSegmentsGeoIndex);
  const pipeSegmentIdsView = new FixedSizeBufferView(
    input.pipeSegmentIds,
    EncodedSize.id,
    decodeId,
  );
  const pipeSegmentCoordinatesView = new FixedSizeBufferView(
    input.pipeSegmentCoordinates,
    EncodedSize.position * 2,
    decodeLineCoordinates,
  );

  const results: EncodedProximityAnomalies = [];

  for (const [nodeId, position] of nodePositionsView.enumerate()) {
    const node: Node = { id: nodeId, position };
    const connectedLinkIds = nodeConnectionsView.getById(node.id) ?? [];

    if (connectedLinkIds.length === 0) {
      continue;
    }

    const candidateConnectionSegments = findCandidateConnectionSegments(
      node,
      pipeSegmentsGeoIndex,
      distanceInMeters,
    );

    const connectedNodeIds = getConnectedNodes(
      connectedLinkIds,
      node.id,
      linkConnectionsView,
    );

    const alternativeConnection = findBestAlternativeConnection(
      node,
      candidateConnectionSegments,
      pipeSegmentIdsView,
      pipeSegmentCoordinatesView,
      connectedLinkIds,
      connectedNodeIds,
      nodePositionsView,
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
  linkConnectionsView: FixedSizeBufferView<[number, number]>,
): number[] {
  const connectedNodes: number[] = [];

  for (const linkId of connectedLinkIds) {
    const [startNode, endNode] = linkConnectionsView.getById(linkId);

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
  geoIndex: Flatbush,
  distanceInMeters: number,
): number[] {
  const [lon, lat] = node.position;
  const searchRadius = Math.max(distanceInMeters, MIN_SEARCH_RADIUS_IN_METERS);
  const deltaLat = searchRadius / LAT_DEGREE_IN_METERS_AT_EQUATOR;
  const deltaLng =
    searchRadius /
    (LAT_DEGREE_IN_METERS_AT_EQUATOR * Math.cos((lat * Math.PI) / 180));

  const candidateSegmentIds = geoIndex.search(
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
  pipeSegmentCoordinatesView: FixedSizeBufferView<[Position, Position]>,
): { position: Position; distance: number } {
  const segment = pipeSegmentCoordinatesView.getById(segmentIndex);
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
  pipeSegmentIdsView: FixedSizeBufferView<number>,
  pipeSegmentCoordinatesView: FixedSizeBufferView<[Position, Position]>,
  alreadyConnectedLinks: number[],
  connectedNodes: number[],
  nodePositionsView: FixedSizeBufferView<Position>,
  distanceInMeters: number,
  connectedJunctionTolerance: number = 0.1,
) {
  const validCandidates: EncodedAlternativeConnection[] = [];
  const alreadyConnectedLinksSet = new Set(alreadyConnectedLinks);

  for (const candidateSegment of candidateConnectionSegments) {
    const pipeId = pipeSegmentIdsView.getById(candidateSegment);
    if (alreadyConnectedLinksSet.has(pipeId)) continue;

    const nearestPoint = findNearestPointOnSegment(
      node,
      candidateSegment,
      pipeSegmentCoordinatesView,
    );
    if (nearestPoint.distance > distanceInMeters) continue;

    if (
      isTooCloseToConnectedJunctions(
        nearestPoint.position,
        connectedNodes,
        nodePositionsView,
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
  nodePositionsView: FixedSizeBufferView<Position>,
  tolerance: number = 0.1,
): boolean {
  for (const connectedNodeId of connectedNodeIds) {
    const connectedNodePosition = nodePositionsView.getById(connectedNodeId);
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
