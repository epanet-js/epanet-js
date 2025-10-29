import type { EncodedCrossingPipes } from "./data";
import type { Position } from "geojson";
import { HydraulicModelBuffers, HydraulicModelBuffersView } from "../hydraulic-model-buffers";
import bbox from "@turf/bbox";
import lineIntersect from "@turf/line-intersect";
import { lineString } from "@turf/helpers";

export function findCrossingPipes(
  buffers: HydraulicModelBuffers,
  junctionTolerance: number,
): EncodedCrossingPipes {
  const views = new HydraulicModelBuffersView(buffers);

  const results: EncodedCrossingPipes = [];
  const alreadySearched = new Set<number>();
  const reportedPairs = new Set<string>();

  for (
    let currentPipeId = 0;
    currentPipeId < views.linksConnections.count;
    currentPipeId++
  ) {
    const currentPipeBounds = views.linkBounds.getById(currentPipeId);

    const otherPipeSegments = findOtherPipeSegmentsNearPipe(
      currentPipeId,
      currentPipeBounds,
      alreadySearched,
      views,
    );

    for (const otherPipeSegmentIdx of otherPipeSegments) {
      const currentPipeSegments = findIntersectingPipeSegmentsForSegment(
        otherPipeSegmentIdx,
        currentPipeId,
        views,
      );

      const otherPipeId = views.pipeSegmentIds.getById(otherPipeSegmentIdx);

      const pairKey = createPairKey(currentPipeId, otherPipeId);
      if (reportedPairs.has(pairKey)) {
        continue;
      }

      let foundIntersection = false;
      for (const currentPipeSegmentIdx of currentPipeSegments) {
        const intersections = calculateIntersectionPoints(
          otherPipeSegmentIdx,
          currentPipeSegmentIdx,
          views,
        );

        for (const intersectionPoint of intersections) {
          if (
            !isTooCloseToNearestJunction(
              intersectionPoint,
              junctionTolerance,
              views,
            )
          ) {
            foundIntersection = true;
            reportedPairs.add(pairKey);
            results.push({
              pipe1Id: currentPipeId,
              pipe2Id: otherPipeId,
              intersectionPoint,
            });
            break;
          }
        }
        if (foundIntersection) break;
      }
    }
    alreadySearched.add(currentPipeId);
  }

  return results;
}

function createPairKey(pipe1Id: number, pipe2Id: number): string {
  const minId = Math.min(pipe1Id, pipe2Id);
  const maxId = Math.max(pipe1Id, pipe2Id);
  return `${minId}-${maxId}`;
}

function findOtherPipeSegmentsNearPipe(
  currentPipeId: number,
  currentPipeBounds: [number, number, number, number],
  excludedPipes: Set<number>,
  views: HydraulicModelBuffersView,
): number[] {
  function isValidOtherPipeSegment(index: number) {
    const segmentPipeId = views.pipeSegmentIds.getById(index);
    if (segmentPipeId === currentPipeId) {
      return false;
    }
    if (excludedPipes.has(segmentPipeId)) {
      return false;
    }
    if (arePipesConnected(currentPipeId, segmentPipeId, views)) {
      return false;
    }

    return true;
  }

  return views.pipeSegmentsGeoIndex.search(
    ...currentPipeBounds,
    isValidOtherPipeSegment,
  );
}

function arePipesConnected(
  pipeAId: number,
  pipeBId: number,
  views: HydraulicModelBuffersView,
): boolean {
  const [pipeAStartNode, pipeAEndNode] =
    views.linksConnections.getById(pipeAId);
  const [pipeBStartNode, pipeBEndNode] =
    views.linksConnections.getById(pipeBId);

  return (
    pipeAStartNode === pipeBStartNode ||
    pipeAStartNode === pipeBEndNode ||
    pipeAEndNode === pipeBStartNode ||
    pipeAEndNode === pipeBEndNode
  );
}

function findIntersectingPipeSegmentsForSegment(
  segmentId: number,
  currentPipeId: number,
  views: HydraulicModelBuffersView,
): number[] {
  function isFromCurrentPipe(index: number) {
    return views.pipeSegmentIds.getById(index) === currentPipeId;
  }

  const segmentCoords = views.pipeSegmentCoordinates.getById(segmentId);
  const [segMinX, segMinY, segMaxX, segMaxY] = bbox(lineString(segmentCoords));

  return views.pipeSegmentsGeoIndex.search(
    segMinX,
    segMinY,
    segMaxX,
    segMaxY,
    isFromCurrentPipe,
  );
}

function calculateIntersectionPoints(
  otherPipeSegmentIdx: number,
  currentPipeSegmentIdx: number,
  views: HydraulicModelBuffersView,
): Position[] {
  const otherPipeCoords =
    views.pipeSegmentCoordinates.getById(otherPipeSegmentIdx);
  const currentPipeCoords = views.pipeSegmentCoordinates.getById(
    currentPipeSegmentIdx,
  );

  const intersections = lineIntersect(
    lineString(otherPipeCoords),
    lineString(currentPipeCoords),
  );

  const intersectionPoints: Position[] = [];
  for (const intersection of intersections.features) {
    if (intersection.geometry.type === "Point") {
      intersectionPoints.push(intersection.geometry.coordinates);
    }
  }

  return intersectionPoints;
}

function isTooCloseToNearestJunction(
  intersectionPoint: Position,
  distanceThreshold: number,
  views: HydraulicModelBuffersView,
): boolean {
  const [lon, lat] = intersectionPoint;

  const tooCloseNodeIndices = views.nodeGeoIndex.neighbors(
    lon,
    lat,
    1,
    distanceThreshold,
  );

  return tooCloseNodeIndices.length !== 0;
}
