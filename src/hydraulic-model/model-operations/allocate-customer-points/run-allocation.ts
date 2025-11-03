import { Point, Feature, point, lineString } from "@turf/helpers";
import turfBuffer from "@turf/buffer";
import turfBbox from "@turf/bbox";
import Flatbush from "flatbush";
import { Position } from "geojson";
import { findJunctionForCustomerPoint } from "../../utilities/junction-assignment";
import { findNearestPointOnLine } from "src/lib/geometry";

import { CustomerPointConnection } from "../../customer-points";
import { AllocationRule } from "./types";
import {
  RunData,
  getSegmentCoordinates,
  getSegmentPipeIndex,
  getPipeId,
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
  customerPointId: number;
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
  let closestMatch: { coordinates: Position; distance: number | null } | null =
    null;
  let closestDistance: number | null = null;
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

      const result = findNearestPointOnLine(
        segmentFeature,
        customerPointFeature,
        {
          units: "meters",
        },
      );

      const distance = result.distance;
      if (
        distance == null ||
        distance > maxDistance ||
        distance > bucketDistance
      ) {
        continue;
      }

      if (
        !closestMatch ||
        (distance != null &&
          (closestDistance == null || distance < closestDistance))
      ) {
        closestMatch = result;
        closestDistance = distance;
        closestSegmentIndex = segmentIndex;
      }
      processedSegmentIds.add(segmentIndex);
    }

    if (closestMatch && closestSegmentIndex !== null) {
      const snapPoint = closestMatch.coordinates;
      const junctionId = findAssignedJunctionId(
        closestSegmentIndex,
        snapPoint,
        workerData,
      );

      if (junctionId !== null) {
        const pipeIndex = getSegmentPipeIndex(
          workerData.segments,
          closestSegmentIndex,
        );
        const pipeId = getPipeId(workerData.pipes, pipeIndex);
        return {
          pipeId,
          snapPoint,
          junctionId,
        };
      }
    }
  }

  return null;
};

const findAssignedJunctionId = (
  segmentIndex: number,
  snapPoint: Position,
  workerData: RunData,
): number | null => {
  const pipeIndex = getSegmentPipeIndex(workerData.segments, segmentIndex);
  const startNodeIndex = getPipeStartNodeIndex(workerData.pipes, pipeIndex);
  const endNodeIndex = getPipeEndNodeIndex(workerData.pipes, pipeIndex);

  const startNode = {
    id: getNodeId(workerData.nodes, startNodeIndex),
    type: getNodeType(workerData.nodes, startNodeIndex),
    coordinates: getNodeCoordinates(workerData.nodes, startNodeIndex),
  };

  const endNode = {
    id: getNodeId(workerData.nodes, endNodeIndex),
    type: getNodeType(workerData.nodes, endNodeIndex),
    coordinates: getNodeCoordinates(workerData.nodes, endNodeIndex),
  };

  return findJunctionForCustomerPoint(startNode, endNode, snapPoint);
};
