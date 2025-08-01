import { Point, Feature, point, lineString } from "@turf/helpers";
import turfDistance from "@turf/distance";
import turfBuffer from "@turf/buffer";
import turfBbox from "@turf/bbox";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import Flatbush from "flatbush";
import { Position } from "geojson";

import { HydraulicModel } from "../../hydraulic-model";
import {
  CustomerPoint,
  CustomerPoints,
  CustomerPointConnection,
} from "../../customer-points";
import { AllocationRule } from "./allocate-customer-points";
import {
  prepareWorkerData,
  WorkerSpatialData,
  getSegmentCoordinates,
  getSegmentPipeIndex,
  getPipeDiameter,
  getPipeStartNodeIndex,
  getPipeEndNodeIndex,
  getNodeCoordinates,
  getNodeType,
  getNodeId,
} from "./prepare-worker-data";

type InputData = {
  allocationRules: AllocationRule[];
  customerPoints: CustomerPoints;
};

export type AllocationResult = {
  allocatedCustomerPoints: CustomerPoints;
  ruleMatches: number[];
};

type AllocationResultItem = {
  customerPointId: string;
  connection: CustomerPointConnection | null;
  ruleIndex: number;
};

const bucketSize = 30;

export const allocateCustomerPointsInWorker = (
  hydraulicModel: HydraulicModel,
  { allocationRules, customerPoints }: InputData,
): AllocationResult => {
  const ruleMatches = allocationRules.map(() => 0);
  const allocatedCustomerPoints = new Map<string, CustomerPoint>();

  const workerData = prepareWorkerData(hydraulicModel, allocationRules);

  const allocationResults = runAllocation(
    workerData,
    customerPoints,
    allocationRules,
  );
  for (const result of allocationResults) {
    if (result.ruleIndex !== -1 && result.connection) {
      const customerPointCopy = customerPoints
        .get(result.customerPointId)
        ?.copy();
      if (customerPointCopy) {
        customerPointCopy.connect(result.connection);
        allocatedCustomerPoints.set(result.customerPointId, customerPointCopy);
        ruleMatches[result.ruleIndex]++;
      }
    }
  }

  return {
    allocatedCustomerPoints,
    ruleMatches,
  };
};

export const runAllocation = (
  workerData: WorkerSpatialData,
  customerPoints: CustomerPoints,
  allocationRules: AllocationRule[],
): AllocationResultItem[] => {
  const results: AllocationResultItem[] = [];
  const spatialIndex = Flatbush.from(workerData.flatbushIndexData);

  if (!spatialIndex || spatialIndex.numItems === 0) {
    for (const customerPoint of customerPoints.values()) {
      results.push({
        customerPointId: customerPoint.id,
        connection: null,
        ruleIndex: -1,
      });
    }
    return results;
  }

  for (const customerPoint of customerPoints.values()) {
    const { ruleIndex, connection } = findFirstMatchingRuleWithWorkerData(
      customerPoint,
      allocationRules,
      { spatialIndex, workerData },
    );

    results.push({
      customerPointId: customerPoint.id,
      connection,
      ruleIndex,
    });
  }

  return results;
};

const findFirstMatchingRuleWithWorkerData = (
  customerPoint: CustomerPoint,
  allocationRules: AllocationRule[],
  spatialData: { spatialIndex: Flatbush; workerData: WorkerSpatialData },
): { ruleIndex: number; connection: CustomerPointConnection | null } => {
  const customerPointFeature = point(customerPoint.coordinates);

  for (let i = 0; i < allocationRules.length; i++) {
    const rule = allocationRules[i];

    const connection = findNearestPipeConnectionWithWorkerData(
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

export function* generateSegmentCandidatesByDistanceWithWorkerData(
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

const findNearestPipeConnectionWithWorkerData = (
  customerPointFeature: Feature<Point>,
  maxDistance: number,
  maxDiameter: number,
  {
    spatialIndex,
    workerData,
  }: { spatialIndex: Flatbush; workerData: WorkerSpatialData },
): CustomerPointConnection | null => {
  let closestMatch: Feature<Point> | null = null;
  let closestSegmentIndex: number | null = null;

  const processedSegmentIds = new Set<number>();
  const candidateGenerator = generateSegmentCandidatesByDistanceWithWorkerData(
    customerPointFeature,
    maxDistance,
    spatialIndex,
  );

  for (const { bucketDistance, candidateIds } of candidateGenerator) {
    for (const segmentIndex of candidateIds) {
      if (processedSegmentIds.has(segmentIndex)) continue;

      const pipeIndex = getSegmentPipeIndex(
        workerData.segmentsData,
        segmentIndex,
      );
      const diameter = getPipeDiameter(workerData.pipesData, pipeIndex);

      if (diameter > maxDiameter) {
        processedSegmentIds.add(segmentIndex);
        continue;
      }

      const segmentCoordinates = getSegmentCoordinates(
        workerData.segmentsData,
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
      const junctionId = findAssignedJunctionIdWithWorkerData(
        closestSegmentIndex,
        snapPoint,
        workerData,
      );

      if (junctionId) {
        const pipeIndex = getSegmentPipeIndex(
          workerData.segmentsData,
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

const findAssignedJunctionIdWithWorkerData = (
  segmentIndex: number,
  snapPoint: Position,
  workerData: WorkerSpatialData,
): string | null => {
  const pipeIndex = getSegmentPipeIndex(workerData.segmentsData, segmentIndex);
  const startNodeIndex = getPipeStartNodeIndex(workerData.pipesData, pipeIndex);
  const endNodeIndex = getPipeEndNodeIndex(workerData.pipesData, pipeIndex);

  const junctionNodes = [];

  if (getNodeType(workerData.nodesData, startNodeIndex) === "junction") {
    junctionNodes.push({
      nodeId: getNodeId(workerData.nodesData, startNodeIndex),
      coordinates: getNodeCoordinates(workerData.nodesData, startNodeIndex),
    });
  }

  if (getNodeType(workerData.nodesData, endNodeIndex) === "junction") {
    junctionNodes.push({
      nodeId: getNodeId(workerData.nodesData, endNodeIndex),
      coordinates: getNodeCoordinates(workerData.nodesData, endNodeIndex),
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
