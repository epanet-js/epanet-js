import { Point, Feature, point } from "@turf/helpers";
import turfDistance from "@turf/distance";
import turfBuffer from "@turf/buffer";
import turfBbox from "@turf/bbox";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import Flatbush from "flatbush";
import { Position } from "geojson";

import { HydraulicModel } from "../hydraulic-model";
import {
  CustomerPoint,
  CustomerPoints,
  CustomerPointConnection,
} from "../customer-points";
import { Pipe } from "../asset-types/pipe";
import { Junction } from "../asset-types/junction";
import { getLinkNodes } from "../assets-map";
import { createSpatialIndex, LinkSegment } from "../spatial-index";
import { getAssetsByType } from "src/__helpers__/asset-queries";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";

export type AllocationRule = {
  maxDistance: number;
  maxDiameter: number;
};

type InputData = {
  allocationRules: AllocationRule[];
  customerPoints: CustomerPoints;
};

export type AllocationResult = {
  allocatedCustomerPoints: CustomerPoints;
  ruleMatches: number[];
};

export const allocateCustomerPoints = withDebugInstrumentation(
  function allocateCustomerPoints(
    hydraulicModel: HydraulicModel,
    { allocationRules, customerPoints }: InputData,
  ): AllocationResult {
    const pipes = getAssetsByType<Pipe>(hydraulicModel.assets, "pipe");
    const spatialIndexData = createSpatialIndex(pipes);

    if (
      !spatialIndexData.spatialIndex ||
      spatialIndexData.segments.length === 0
    ) {
      return {
        allocatedCustomerPoints: new Map(),
        ruleMatches: allocationRules.map(() => 0),
      };
    }

    const allocatedCustomerPoints = new Map<string, CustomerPoint>();
    const ruleMatches = allocationRules.map(() => 0);

    for (const customerPoint of customerPoints.values()) {
      const { ruleIndex, connection } = findFirstMatchingRule(
        customerPoint,
        allocationRules,
        spatialIndexData,
        hydraulicModel.assets,
      );

      if (ruleIndex !== -1 && connection) {
        const customerPointCopy = customerPoint.copy();
        customerPointCopy.connect(connection);
        allocatedCustomerPoints.set(customerPoint.id, customerPointCopy);
        ruleMatches[ruleIndex]++;
      }
    }

    return {
      allocatedCustomerPoints,
      ruleMatches,
    };
  },
  {
    name: "allocateCustomerPoints",
    maxDurationMs: 30000,
  },
);

const findFirstMatchingRule = (
  customerPoint: CustomerPoint,
  allocationRules: AllocationRule[],
  spatialIndexData: {
    spatialIndex: Flatbush | null;
    segments: LinkSegment[];
  },
  assets: HydraulicModel["assets"],
): { ruleIndex: number; connection: CustomerPointConnection | null } => {
  const customerPointFeature = point(customerPoint.coordinates);

  if (!spatialIndexData.spatialIndex) {
    return { ruleIndex: -1, connection: null };
  }

  for (let i = 0; i < allocationRules.length; i++) {
    const rule = allocationRules[i];

    const connection = findNearestPipeConnectionWithinDistance(
      customerPointFeature,
      rule.maxDistance,
      rule.maxDiameter,
      {
        spatialIndex: spatialIndexData.spatialIndex,
        segments: spatialIndexData.segments,
      },
      assets,
    );

    if (connection) {
      return { ruleIndex: i, connection };
    }
  }

  return { ruleIndex: -1, connection: null };
};

const findNearestPipeConnectionWithinDistance = (
  customerPointFeature: Feature<Point>,
  maxDistance: number,
  maxDiameter: number,
  spatialIndexData: { spatialIndex: Flatbush; segments: LinkSegment[] },
  assets: HydraulicModel["assets"],
): CustomerPointConnection | null => {
  const { spatialIndex, segments } = spatialIndexData;

  const searchBuffer = turfBuffer(customerPointFeature, maxDistance, {
    units: "meters",
  });

  const [minX, minY, maxX, maxY] = turfBbox(searchBuffer);
  const candidateIds = spatialIndex.search(minX, minY, maxX, maxY);

  if (candidateIds.length === 0) {
    return null;
  }

  let closestMatch: Feature<Point> | null = null;
  let closestPipeId: string | null = null;

  for (const id of candidateIds) {
    const candidateSegment = segments[id];
    const linkId = candidateSegment.properties.linkId;

    const pipe = assets.get(linkId) as Pipe;
    if (!pipe || pipe.diameter > maxDiameter) {
      continue;
    }

    const pointOnLine = nearestPointOnLine(
      candidateSegment,
      customerPointFeature,
      {
        units: "meters",
      },
    );

    const distance = pointOnLine.properties?.dist;
    if (distance == null || distance > maxDistance) {
      continue;
    }

    if (
      !closestMatch ||
      (closestMatch.properties?.dist != null &&
        distance < closestMatch.properties.dist)
    ) {
      closestMatch = pointOnLine;
      closestPipeId = linkId;
    }
  }

  if (!closestMatch || !closestPipeId) {
    return null;
  }

  const snapPoint = closestMatch.geometry.coordinates as Position;
  const junction = findAssignedJunction(closestPipeId, snapPoint, assets);
  if (!junction) {
    return null;
  }

  return {
    pipeId: closestPipeId,
    snapPoint,
    distance: closestMatch.properties?.dist || 0,
    junction,
  };
};

const calculateDistanceMeters = (a: Position, b: Position): number => {
  return turfDistance(a, b, { units: "meters" });
};

const findAssignedJunction = (
  pipeId: string,
  snapPoint: Position,
  assets: HydraulicModel["assets"],
): Junction | null => {
  const pipe = assets.get(pipeId) as Pipe;
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
    distance: calculateDistanceMeters(snapPoint, junction.coordinates),
  }));

  junctionDistances.sort((a, b) => a.distance - b.distance);
  return junctionDistances[0].junction;
};
