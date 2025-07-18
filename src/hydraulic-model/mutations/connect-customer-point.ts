import { LineString, Point, Feature, point } from "@turf/helpers";
import { getCoord } from "@turf/invariant";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import Flatbush from "flatbush";
import { Position } from "geojson";

import {
  CustomerPoint,
  CustomerPointConnection,
} from "src/hydraulic-model/customer-points";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import { getLinkNodes } from "src/hydraulic-model/assets-map";
import { SpatialIndexData } from "src/hydraulic-model/spatial-index";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";

const INITIAL_SEARCH_RADIUS_METERS = 10;
const NEAREST_NEIGHBOR_COUNT = 5;

export const connectCustomerPoint = (
  hydraulicModel: HydraulicModel,
  spatialIndexData: SpatialIndexData,
  customerPoint: CustomerPoint,
): CustomerPointConnection | null => {
  const { spatialIndex, segments } = spatialIndexData;

  if (!spatialIndex || segments.length === 0) {
    return null;
  }

  const connection = findNearestPipeConnection(
    customerPoint,
    spatialIndex,
    segments,
  );
  if (!connection) {
    return null;
  }

  const assignedJunction = assignJunctionToCustomerPoint(
    customerPoint,
    connection,
    hydraulicModel.assets,
  );

  if (assignedJunction) {
    connection.junction = assignedJunction;

    customerPoint.connect(connection);
    hydraulicModel.customerPoints.set(customerPoint.id, customerPoint);
    assignedJunction.assignCustomerPoint(customerPoint);

    return connection;
  }

  return null;
};

const locateNearestPointOnNetwork = (
  targetPoint: Feature<Point>,
  searchIndex: Flatbush,
  segments: Feature<LineString>[],
): Feature<Point> | null => {
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
};

const findNearestPipeConnection = (
  customerPoint: CustomerPoint,
  searchIndex: Flatbush | null,
  segments: Feature<LineString>[],
): CustomerPointConnection | null => {
  if (!searchIndex || segments.length === 0) {
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
    snapPoint: nearestPoint.geometry.coordinates as Position,
    distance: nearestPoint.properties?.dist || 0,
  };
};

const calculateDistance = (point1: Position, point2: Position): number => {
  const [x1, y1] = point1;
  const [x2, y2] = point2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
};

const assignJunctionToCustomerPoint = (
  customerPoint: CustomerPoint,
  connection: CustomerPointConnection,
  assets: HydraulicModel["assets"],
): Junction | null => {
  const pipe = assets.get(connection.pipeId) as Pipe;
  if (!pipe) return null;

  const { startNode, endNode } = getLinkNodes(assets, pipe);

  const junctionNodes = [startNode, endNode].filter(
    (node) => node && node.type === "junction",
  ) as Junction[];

  if (junctionNodes.length === 0) {
    return null;
  }

  if (junctionNodes.length === 1) {
    return junctionNodes[0];
  }

  const junctionDistances = junctionNodes.map((junction) => ({
    junction,
    distance: calculateDistance(connection.snapPoint, junction.coordinates),
  }));

  junctionDistances.sort((a, b) => a.distance - b.distance);
  return junctionDistances[0].junction;
};
