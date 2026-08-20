import { Point, Feature, lineString } from "@turf/helpers";
import Flatbush from "flatbush";
import type { Position } from "geojson";
import { findJunctionForCustomerPoint } from "../../hydraulic-model/utilities/junction-assignment";
import { findNearestPointOnLine } from "@epanet-js/geometry";

import type { CustomerPointConnection } from "@epanet-js/hydraulic-model";
import { RunDataView, PipeSegmentsView } from "./run-data";

const bucketSize = 30;

export const buildBucketDistances = (maxDistance: number): number[] => {
  const bucketDistances: number[] = [];

  for (
    let distance = bucketSize;
    distance < maxDistance;
    distance += bucketSize
  ) {
    bucketDistances.push(distance);
  }

  if (maxDistance > 0) {
    bucketDistances.push(maxDistance);
  }

  return bucketDistances;
};

// Planar ranking is accurate to a few centimetres over the search radii used
// here, so a one metre band around the best candidate is wide enough that the
// exact geodesic pass still sees every pipe segment that could win.
const RANKING_TOLERANCE_IN_METERS = 1;

const EARTH_RADIUS_IN_METERS = 6371008.8;
const METERS_PER_DEGREE = (Math.PI * EARTH_RADIUS_IN_METERS) / 180;
const MIN_LONGITUDE_SCALE = 1e-6;

// Bounds that fully contain the circle of the given radius. Longitude is scaled
// at the latitude furthest from the equator the circle reaches, so the box never
// clips the search area at its widest point.
export const searchBounds = (
  [longitude, latitude]: Position,
  distanceInMeters: number,
): [number, number, number, number] => {
  const latitudeSpan = distanceInMeters / METERS_PER_DEGREE;
  const widestLatitude = Math.min(90, Math.abs(latitude) + latitudeSpan);
  const longitudeScale = Math.max(
    Math.cos((widestLatitude * Math.PI) / 180),
    MIN_LONGITUDE_SCALE,
  );
  const longitudeSpan = latitudeSpan / longitudeScale;

  return [
    longitude - longitudeSpan,
    latitude - latitudeSpan,
    longitude + longitudeSpan,
    latitude + latitudeSpan,
  ];
};

function* generatePipeSegmentCandidatesByDistance(
  customerPointFeature: Feature<Point>,
  maxDistance: number,
  spatialIndex: Flatbush,
): Generator<
  { bucketDistance: number; candidateIds: number[] },
  void,
  unknown
> {
  const coordinates = customerPointFeature.geometry.coordinates;

  for (const bucketDistance of buildBucketDistances(maxDistance)) {
    const [minX, minY, maxX, maxY] = searchBounds(coordinates, bucketDistance);
    const candidateIds = spatialIndex.search(minX, minY, maxX, maxY);

    yield { bucketDistance, candidateIds };
  }
}

// Distance from the customer point to a pipe segment, in a local plane centred on
// the customer point. Ranks candidates so the exact geodesic pass only runs on
// the ones that can win.
export const approximatePipeSegmentDistance = (
  pipeSegments: PipeSegmentsView,
  pipeSegmentIndex: number,
  originLongitude: number,
  originLatitude: number,
  longitudeScale: number,
): number => {
  const startX =
    (pipeSegments.getStartLongitude(pipeSegmentIndex) - originLongitude) *
    longitudeScale;
  const startY =
    (pipeSegments.getStartLatitude(pipeSegmentIndex) - originLatitude) *
    METERS_PER_DEGREE;
  const endX =
    (pipeSegments.getEndLongitude(pipeSegmentIndex) - originLongitude) *
    longitudeScale;
  const endY =
    (pipeSegments.getEndLatitude(pipeSegmentIndex) - originLatitude) *
    METERS_PER_DEGREE;

  const spanX = endX - startX;
  const spanY = endY - startY;
  const lengthSquared = spanX * spanX + spanY * spanY;

  let position = 0;
  if (lengthSquared > 0) {
    position = -(startX * spanX + startY * spanY) / lengthSquared;
    position = position < 0 ? 0 : position > 1 ? 1 : position;
  }

  const closestX = startX + position * spanX;
  const closestY = startY + position * spanY;

  return Math.sqrt(closestX * closestX + closestY * closestY);
};

export const findNearestPipeConnection = (
  customerPointFeature: Feature<Point>,
  maxDistance: number,
  maxDiameter: number,
  data: RunDataView,
): CustomerPointConnection | null => {
  const { spatialIndex, pipeSegments, pipes } = data;
  let closestMatch: {
    coordinates: Position;
    distance: number;
    pipeSegmentIndex: number;
  } | null = null;

  const processedPipeSegmentIds = new Set<number>();
  const candidateGenerator = generatePipeSegmentCandidatesByDistance(
    customerPointFeature,
    maxDistance,
    spatialIndex,
  );

  const [originLongitude, originLatitude] = customerPointFeature.geometry
    .coordinates as [number, number];
  const longitudeScale =
    METERS_PER_DEGREE * Math.cos((originLatitude * Math.PI) / 180);

  const ranked: { pipeSegmentIndex: number; rankingDistance: number }[] = [];

  for (const { bucketDistance, candidateIds } of candidateGenerator) {
    ranked.length = 0;
    const rankingLimit =
      Math.min(maxDistance, bucketDistance) + RANKING_TOLERANCE_IN_METERS;

    for (const pipeSegmentIndex of candidateIds) {
      if (processedPipeSegmentIds.has(pipeSegmentIndex)) continue;

      const pipeIndex = pipeSegments.getPipeIndex(pipeSegmentIndex);
      const diameter = pipes.getDiameter(pipeIndex);

      if (diameter > maxDiameter) {
        processedPipeSegmentIds.add(pipeSegmentIndex);
        continue;
      }

      const rankingDistance = approximatePipeSegmentDistance(
        pipeSegments,
        pipeSegmentIndex,
        originLongitude,
        originLatitude,
        longitudeScale,
      );

      if (rankingDistance > rankingLimit) continue;

      ranked.push({ pipeSegmentIndex, rankingDistance });
    }

    ranked.sort((a, b) => a.rankingDistance - b.rankingDistance);

    for (const candidate of ranked) {
      if (
        closestMatch &&
        candidate.rankingDistance >
          closestMatch.distance + RANKING_TOLERANCE_IN_METERS
      ) {
        break;
      }

      const pipeSegmentCoordinates = pipeSegments.getCoordinates(
        candidate.pipeSegmentIndex,
      );
      const pipeSegmentFeature = lineString(pipeSegmentCoordinates);

      const result = findNearestPointOnLine(
        pipeSegmentFeature,
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

      processedPipeSegmentIds.add(candidate.pipeSegmentIndex);

      if (!closestMatch || distance < closestMatch.distance) {
        closestMatch = {
          coordinates: result.coordinates,
          distance,
          pipeSegmentIndex: candidate.pipeSegmentIndex,
        };
      }
    }

    if (closestMatch) {
      const junctionId = findAssignedJunctionId(
        closestMatch.pipeSegmentIndex,
        closestMatch.coordinates,
        data,
      );
      const pipeIndex = pipeSegments.getPipeIndex(
        closestMatch.pipeSegmentIndex,
      );
      return {
        pipeId: pipes.getId(pipeIndex),
        snapPoint: closestMatch.coordinates,
        junctionId,
      };
    }
  }

  return null;
};

const findAssignedJunctionId = (
  pipeSegmentIndex: number,
  snapPoint: Position,
  data: RunDataView,
): number => {
  const { pipeSegments, pipes, nodes } = data;

  const pipeIndex = pipeSegments.getPipeIndex(pipeSegmentIndex);
  const startNodeIndex = pipes.getStartNodeIndex(pipeIndex);
  const endNodeIndex = pipes.getEndNodeIndex(pipeIndex);

  const startNode = {
    id: nodes.getId(startNodeIndex),
    type: nodes.getType(startNodeIndex),
    coordinates: nodes.getCoordinates(startNodeIndex),
  };

  const endNode = {
    id: nodes.getId(endNodeIndex),
    type: nodes.getType(endNodeIndex),
    coordinates: nodes.getCoordinates(endNodeIndex),
  };

  const junctionId = findJunctionForCustomerPoint(
    startNode,
    endNode,
    snapPoint,
  );

  if (junctionId === null) {
    throw new Error(
      `Pipe ${pipes.getId(pipeIndex)} has no junction endpoint and should not have been indexed for allocation`,
    );
  }

  return junctionId;
};
