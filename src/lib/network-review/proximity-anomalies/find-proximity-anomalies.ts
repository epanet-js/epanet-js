import Flatbush from "flatbush";
import {
  TopologyBufferView,
  EncodedProximityAnomalies,
  RunData,
  Node,
  SegmentsGeometriesBufferView,
  EncodedAlternativeConnection,
} from "./data";
import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import distance from "@turf/distance";
import { Position } from "geojson";

export function findProximityAnomalies(
  input: RunData,
  distanceInMeters: number = 0.5,
  connectedJunctionTolerance: number = 0.1,
): EncodedProximityAnomalies {
  const topology = new TopologyBufferView(input.nodeBuffer, input.linksBuffer);
  const pipeSegmentsGeoIndex = Flatbush.from(input.pipeSegmentsGeoIndex);
  const pipeSegmentsLookup = new SegmentsGeometriesBufferView(
    input.pipeSegmentsBuffer,
  );

  const { nodeLinksConnectivityLookup, nodesConnectivityLookookup } =
    createConnectivityLookups(topology);

  const results: EncodedProximityAnomalies = [];

  for (const node of topology.nodes()) {
    const alreadyConnectedLinks =
      nodeLinksConnectivityLookup.get(node.id) || new Set();

    if (alreadyConnectedLinks.size === 0) continue;

    const candidateConnectionSegments = findCandidateConnectionSegments(
      node,
      pipeSegmentsGeoIndex,
      distanceInMeters,
    );

    const connectedNodes = nodesConnectivityLookookup.get(node.id) || new Set();

    const alternativeConnection = findBestAlternativeConnection(
      node,
      candidateConnectionSegments,
      pipeSegmentsLookup,
      alreadyConnectedLinks,
      connectedNodes,
      topology,
      distanceInMeters,
      connectedJunctionTolerance,
    );

    if (alternativeConnection) {
      results.push({
        nodeId: node.id,
        connection: alternativeConnection,
      });
      continue;
    }
  }

  return results;
}

function createConnectivityLookups(data: TopologyBufferView) {
  const nodeLinksConnectivityLookup = new Map<number, Set<number>>();
  const nodesConnectivityLookookup = new Map<number, Set<number>>();

  for (const link of data.links()) {
    const { startNode, endNode, id: linkId } = link;

    // Map the upstream node to the link
    if (!nodeLinksConnectivityLookup.has(startNode)) {
      nodeLinksConnectivityLookup.set(startNode, new Set());
    }
    nodeLinksConnectivityLookup.get(startNode)!.add(linkId);

    // Map the downstream node to the link
    if (!nodeLinksConnectivityLookup.has(endNode)) {
      nodeLinksConnectivityLookup.set(endNode, new Set());
    }
    nodeLinksConnectivityLookup.get(endNode)!.add(linkId);

    // Map the upstream node to the downstream node
    if (!nodesConnectivityLookookup.has(startNode)) {
      nodesConnectivityLookookup.set(startNode, new Set());
    }
    nodesConnectivityLookookup.get(startNode)!.add(endNode);

    // Map the downstream node to the upstream node
    if (!nodesConnectivityLookookup.has(endNode)) {
      nodesConnectivityLookookup.set(endNode, new Set());
    }
    nodesConnectivityLookookup.get(endNode)!.add(startNode);
  }

  return { nodeLinksConnectivityLookup, nodesConnectivityLookookup };
}

const LAT_DEGREE_IN_METERS_AT_EQUATOR = 111320;
const MIN_SEARCH_RADIUS_IN_METERS = 0.1;

function findCandidateConnectionSegments(
  node: Node,
  geoIndex: Flatbush,
  distanceInMeters: number,
): number[] {
  const [lon, lat] = node.position;
  const searchRadius = Math.max(
    distanceInMeters < 10
      ? distanceInMeters + MIN_SEARCH_RADIUS_IN_METERS
      : distanceInMeters,
    MIN_SEARCH_RADIUS_IN_METERS,
  );
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
  pipeSegments: SegmentsGeometriesBufferView,
): { position: Position; distance: number } {
  const segment = pipeSegments.getCoordinates(segmentIndex);
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
  pipeSegmentsLookup: SegmentsGeometriesBufferView,
  alreadyConnectedLinks: Set<number>,
  connectedNodes: Set<number>,
  topology: TopologyBufferView,
  distanceInMeters: number,
  connectedJunctionTolerance: number = 0.1,
) {
  const validCandidates: EncodedAlternativeConnection[] = [];

  for (const candidateSegment of candidateConnectionSegments) {
    const pipeId = pipeSegmentsLookup.getId(candidateSegment);
    if (alreadyConnectedLinks.has(pipeId)) continue;

    const nearestPoint = findNearestPointOnSegment(
      node,
      candidateSegment,
      pipeSegmentsLookup,
    );
    if (nearestPoint.distance > distanceInMeters) continue;

    if (
      isTooCloseToConnectedJunctions(
        nearestPoint.position,
        connectedNodes,
        topology,
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
  connectedNodeIds: Set<number>,
  topology: TopologyBufferView,
  tolerance: number = 0.1,
): boolean {
  for (const connectedNodeId of connectedNodeIds) {
    const connectedNode = topology.getNodeByIndex(connectedNodeId);
    if (!connectedNode) continue;

    const dist = distance(point(nearestPoint), point(connectedNode.position), {
      units: "meters",
    });
    if (dist < tolerance) {
      return true;
    }
  }

  return false;
}
