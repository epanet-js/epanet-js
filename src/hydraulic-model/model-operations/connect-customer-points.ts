import {
  FeatureCollection,
  LineString,
  Point,
  Feature,
  point,
} from "@turf/helpers";
import { getCoord } from "@turf/invariant";
import lineSegment from "@turf/line-segment";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import bbox from "@turf/bbox";
import Flatbush from "flatbush";

import {
  CustomerPoint,
  CustomerPointConnection,
} from "src/hydraulic-model/customer-points";
import { AssetsMap } from "src/hydraulic-model";
import { extractPipeNetwork } from "src/lib/spatial-index/pipe-network";

const INITIAL_SEARCH_RADIUS_METERS = 10;
const NEAREST_NEIGHBOR_COUNT = 5;

function createSpatialIndex(lineNetwork: FeatureCollection<LineString>): {
  spatialIndex: Flatbush;
  segments: Feature<LineString>[];
} {
  const allSegments: Feature<LineString>[] = [];

  for (const pipeFeature of lineNetwork.features) {
    const segments = lineSegment(pipeFeature);
    for (const segment of segments.features) {
      segment.properties = {
        ...segment.properties,
        pipeId: pipeFeature.properties?.pipeId || "unknown",
      };
      allSegments.push(segment);
    }
  }

  const spatialIndex = new Flatbush(allSegments.length);

  for (const segment of allSegments) {
    const [minX, minY, maxX, maxY] = bbox(segment);
    spatialIndex.add(minX, minY, maxX, maxY);
  }

  spatialIndex.finish();
  return { spatialIndex, segments: allSegments };
}

function locateNearestPointOnNetwork(
  targetPoint: Feature<Point>,
  searchIndex: Flatbush,
  segments: Feature<LineString>[],
): Feature<Point> | null {
  if (segments.length === 0) {
    return null;
  }

  const [x, y] = getCoord(targetPoint);
  const searchBufferDegrees = INITIAL_SEARCH_RADIUS_METERS / 111139;

  let candidateIds = searchIndex.search(
    x - searchBufferDegrees,
    y - searchBufferDegrees,
    x + searchBufferDegrees,
    y + searchBufferDegrees,
  );

  if (candidateIds.length === 0) {
    candidateIds = searchIndex.neighbors(x, y, NEAREST_NEIGHBOR_COUNT);
  }

  if (candidateIds.length === 0) {
    return null;
  }

  let closestMatch: Feature<Point> | null = null;
  let closestSegment: Feature<LineString> | null = null;

  for (const id of candidateIds) {
    const candidateSegment = segments[id];
    const pointOnLine = nearestPointOnLine(candidateSegment, targetPoint, {
      units: "meters",
    });

    if (
      !closestMatch ||
      (pointOnLine.properties?.dist != null &&
        closestMatch.properties?.dist != null &&
        pointOnLine.properties.dist < closestMatch.properties.dist)
    ) {
      closestMatch = pointOnLine;
      closestSegment = candidateSegment;
    }
  }

  if (closestMatch && closestSegment && closestMatch.properties) {
    closestMatch.properties.sourceSegment = closestSegment;
  }

  return closestMatch;
}

function findNearestPipeConnection(
  customerPoint: CustomerPoint,
  searchIndex: Flatbush,
  segments: Feature<LineString>[],
): CustomerPointConnection | null {
  if (segments.length === 0) {
    return null;
  }

  const customerPointFeature = point(customerPoint.coordinates);
  const nearestPoint = locateNearestPointOnNetwork(
    customerPointFeature,
    searchIndex,
    segments,
  );

  if (!nearestPoint) {
    return null;
  }

  const sourceSegment = nearestPoint.properties?.sourceSegment;
  const pipeId = sourceSegment?.properties?.pipeId || "unknown";

  return {
    pipeId,
    snapPoint: nearestPoint.geometry.coordinates as [number, number],
    distance: nearestPoint.properties?.dist || 0,
  };
}

function calculateConnections(
  customerPoints: Map<string, CustomerPoint>,
  pipeNetwork: FeatureCollection<LineString>,
): Map<string, CustomerPointConnection> {
  const connections = new Map<string, CustomerPointConnection>();

  if (customerPoints.size === 0 || pipeNetwork.features.length === 0) {
    return connections;
  }

  const { spatialIndex, segments } = createSpatialIndex(pipeNetwork);

  for (const [id, customerPoint] of customerPoints) {
    const connection = findNearestPipeConnection(
      customerPoint,
      spatialIndex,
      segments,
    );
    if (connection) {
      connections.set(id, connection);
    }
  }

  return connections;
}

export function connectCustomerPointsToPipes(
  customerPoints: Map<string, CustomerPoint>,
  assets: AssetsMap,
): Map<string, CustomerPoint> {
  const pipeNetwork = extractPipeNetwork(assets);
  const connections = calculateConnections(customerPoints, pipeNetwork);

  const connectedCustomerPoints = new Map<string, CustomerPoint>();
  for (const [id, customerPoint] of customerPoints) {
    connectedCustomerPoints.set(id, {
      ...customerPoint,
      connection: connections.get(id),
    });
  }

  return connectedCustomerPoints;
}
