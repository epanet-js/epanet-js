import { Point, Feature, point, lineString } from "@turf/helpers";
import turfDistance from "@turf/distance";
import turfBuffer from "@turf/buffer";
import turfBbox from "@turf/bbox";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import Flatbush from "flatbush";
import { Position } from "geojson";

import { CustomerPointConnection } from "../../customer-points";
import { AllocationRule } from "./types";
import {
  RunData,
  getSegmentCoordinates,
  getSegmentPipeIndex,
  getPipeDiameter,
  getPipeStartNodeIndex,
  getPipeEndNodeIndex,
  getNodeCoordinates,
  getNodeType,
  getNodeId,
  getCustomerPointCoordinates,
  getCustomerPointId,
} from "./prepare-data";

export type AllocationResultItem = {
  customerPointId: string;
  connection: CustomerPointConnection | null;
  ruleIndex: number;
};

const bucketSize = 30;

export const runAllocation = (
  workerData: RunData,
  allocationRules: AllocationRule[],
  offset: number = 0,
  count?: number,
): AllocationResultItem[] => {
  const results: AllocationResultItem[] = [];
  const spatialIndex = Flatbush.from(workerData.flatbushIndex);

  const totalCustomerPointsCount = new DataView(
    workerData.customerPoints,
  ).getUint32(0, true);

  const actualCount = count ?? totalCustomerPointsCount - offset;
  const endIndex = Math.min(offset + actualCount, totalCustomerPointsCount);

  if (!spatialIndex || spatialIndex.numItems === 0) {
    for (let i = offset; i < endIndex; i++) {
      const customerPointId = getCustomerPointId(workerData.customerPoints, i);
      results.push({
        customerPointId,
        connection: null,
        ruleIndex: -1,
      });
    }
    return results;
  }

  for (let i = offset; i < endIndex; i++) {
    const customerPointId = getCustomerPointId(workerData.customerPoints, i);
    const customerPointCoordinates = getCustomerPointCoordinates(
      workerData.customerPoints,
      i,
    );

    const { ruleIndex, connection } = findFirstMatchingRule(
      customerPointCoordinates,
      allocationRules,
      { spatialIndex, workerData },
    );

    results.push({
      customerPointId,
      connection,
      ruleIndex,
    });
  }

  return results;
};

const findFirstMatchingRule = (
  customerPointCoordinates: Position,
  allocationRules: AllocationRule[],
  spatialData: { spatialIndex: Flatbush; workerData: RunData },
): { ruleIndex: number; connection: CustomerPointConnection | null } => {
  const customerPointFeature = point(customerPointCoordinates);

  for (let i = 0; i < allocationRules.length; i++) {
    const rule = allocationRules[i];

    const connection = findNearestPipeConnection(
      customerPointFeature,
      rule.maxDistance,
      rule.maxDiameter,
      spatialData,
    );

    if (connection) {
      return { ruleIndex: i, connection };
    }
  }

  return { ruleIndex: -1, connection: null };
};

export function* generateSegmentCandidatesByDistance(
  customerPointFeature: Feature<Point>,
  maxDistance: number,
  spatialIndex: Flatbush,
): Generator<
  { bucketDistance: number; candidateIds: number[] },
  void,
  unknown
> {
  for (
    let bucketDistance = bucketSize;
    bucketDistance <= maxDistance;
    bucketDistance += bucketSize
  ) {
    const searchBuffer = turfBuffer(customerPointFeature, bucketDistance, {
      units: "meters",
    });

    const [minX, minY, maxX, maxY] = turfBbox(searchBuffer);
    const candidateIds = spatialIndex.search(minX, minY, maxX, maxY);

    yield { bucketDistance, candidateIds };
  }
}

const findNearestPipeConnection = (
  customerPointFeature: Feature<Point>,
  maxDistance: number,
  maxDiameter: number,
  { spatialIndex, workerData }: { spatialIndex: Flatbush; workerData: RunData },
): CustomerPointConnection | null => {
  let closestMatch: Feature<Point> | null = null;
  let closestSegmentIndex: number | null = null;

  const processedSegmentIds = new Set<number>();
  const candidateGenerator = generateSegmentCandidatesByDistance(
    customerPointFeature,
    maxDistance,
    spatialIndex,
  );

  for (const { bucketDistance, candidateIds } of candidateGenerator) {
    for (const segmentIndex of candidateIds) {
      if (processedSegmentIds.has(segmentIndex)) continue;

      const pipeIndex = getSegmentPipeIndex(workerData.segments, segmentIndex);
      const diameter = getPipeDiameter(workerData.pipes, pipeIndex);

      if (diameter > maxDiameter) {
        processedSegmentIds.add(segmentIndex);
        continue;
      }

      const segmentCoordinates = getSegmentCoordinates(
        workerData.segments,
        segmentIndex,
      );
      const segmentFeature = lineString(segmentCoordinates);

      const pointOnLine = nearestPointOnLine(
        segmentFeature,
        customerPointFeature,
        {
          units: "meters",
        },
      );

      const distance = pointOnLine.properties?.dist;
      if (
        distance == null ||
        distance > maxDistance ||
        distance > bucketDistance
      ) {
        continue;
      }

      if (
        !closestMatch ||
        (closestMatch.properties?.dist != null &&
          distance < closestMatch.properties.dist)
      ) {
        closestMatch = pointOnLine;
        closestSegmentIndex = segmentIndex;
      }
      processedSegmentIds.add(segmentIndex);
    }

    if (closestMatch && closestSegmentIndex !== null) {
      const snapPoint = closestMatch.geometry.coordinates as Position;
      const junctionId = findAssignedJunctionId(
        closestSegmentIndex,
        snapPoint,
        workerData,
      );

      if (junctionId) {
        const pipeIndex = getSegmentPipeIndex(
          workerData.segments,
          closestSegmentIndex,
        );
        return {
          pipeId: `pipe-${pipeIndex}`,
          snapPoint,
          distance: closestMatch.properties?.dist || 0,
          junctionId,
        };
      }
    }
  }

  return null;
};

const calculateDistanceMeters = (a: Position, b: Position): number => {
  return turfDistance(a, b, { units: "meters" });
};

const findAssignedJunctionId = (
  segmentIndex: number,
  snapPoint: Position,
  workerData: RunData,
): string | null => {
  const pipeIndex = getSegmentPipeIndex(workerData.segments, segmentIndex);
  const startNodeIndex = getPipeStartNodeIndex(workerData.pipes, pipeIndex);
  const endNodeIndex = getPipeEndNodeIndex(workerData.pipes, pipeIndex);

  const junctionNodes = [];

  if (getNodeType(workerData.nodes, startNodeIndex) === "junction") {
    junctionNodes.push({
      nodeId: getNodeId(workerData.nodes, startNodeIndex),
      coordinates: getNodeCoordinates(workerData.nodes, startNodeIndex),
    });
  }

  if (getNodeType(workerData.nodes, endNodeIndex) === "junction") {
    junctionNodes.push({
      nodeId: getNodeId(workerData.nodes, endNodeIndex),
      coordinates: getNodeCoordinates(workerData.nodes, endNodeIndex),
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
    distance: calculateDistanceMeters(snapPoint, junction.coordinates),
  }));

  junctionDistances.sort((a, b) => a.distance - b.distance);
  return junctionDistances[0].junction.nodeId;
};
