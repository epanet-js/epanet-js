import type { EncodedCrossingPipes, EncodedPipe, RunData } from "./data";
import { PipeBufferView, SegmentsGeometriesBufferView } from "./data";
import type { Position } from "geojson";
import Flatbush from "flatbush";
import bbox from "@turf/bbox";
import lineIntersect from "@turf/line-intersect";
import { lineString } from "@turf/helpers";

export function findCrossingPipes(
  input: RunData,
  junctionTolerance: number,
): EncodedCrossingPipes {
  const pipes = new PipeBufferView(input.pipeBuffer);
  const nodeGeoIndex = Flatbush.from(input.nodeGeoIndex);
  const pipeSegmentsGeoIndex = Flatbush.from(input.pipeSegmentsGeoIndex);
  const pipeSegmentsLookup = new SegmentsGeometriesBufferView(
    input.pipeSegmentsBuffer,
  );

  const results: EncodedCrossingPipes = [];
  const alreadySearched = new Set<number>();
  const reportedPairs = new Set<string>();

  for (const currentPipe of pipes.iter()) {
    const otherPipeSegments = findOtherPipeSegmentsNearPipe(
      currentPipe,
      alreadySearched,
      pipeSegmentsLookup,
      pipeSegmentsGeoIndex,
      pipes,
    );

    for (const otherPipeSegmentIdx of otherPipeSegments) {
      const currentPipeSegments = findIntersectingPipeSegmentsForSegment(
        otherPipeSegmentIdx,
        currentPipe.id,
        pipeSegmentsLookup,
        pipeSegmentsGeoIndex,
      );

      const otherPipeId = pipeSegmentsLookup.getId(otherPipeSegmentIdx);

      const pairKey = createPairKey(currentPipe.id, otherPipeId);
      if (reportedPairs.has(pairKey)) {
        continue;
      }

      let foundIntersection = false;
      for (const currentPipeSegmentIdx of currentPipeSegments) {
        const intersections = calculateIntersectionPoints(
          otherPipeSegmentIdx,
          currentPipeSegmentIdx,
          pipeSegmentsLookup,
        );

        for (const intersectionPoint of intersections) {
          if (
            !isTooCloseToNearestJunction(
              intersectionPoint,
              junctionTolerance,
              nodeGeoIndex,
            )
          ) {
            foundIntersection = true;
            reportedPairs.add(pairKey);
            results.push({
              pipe1Id: currentPipe.id,
              pipe2Id: otherPipeId,
              intersectionPoint,
            });
            break;
          }
        }
        if (foundIntersection) break;
      }
    }
    alreadySearched.add(currentPipe.id);
  }

  return results;
}

function createPairKey(pipe1Id: number, pipe2Id: number): string {
  const minId = Math.min(pipe1Id, pipe2Id);
  const maxId = Math.max(pipe1Id, pipe2Id);
  return `${minId}-${maxId}`;
}

function findOtherPipeSegmentsNearPipe(
  pipe: EncodedPipe,
  excludedPipes: Set<number>,
  pipeSegmentsLookup: SegmentsGeometriesBufferView,
  pipeSegmentsGeoIndex: Flatbush,
  pipes: PipeBufferView,
): number[] {
  function isValidOtherPipeSegment(index: number) {
    const segmentPipeId = pipeSegmentsLookup.getId(index);
    if (segmentPipeId === pipe.id) {
      return false;
    }
    if (excludedPipes.has(segmentPipeId)) {
      return false;
    }
    if (arePipesConnected(pipe.id, segmentPipeId, pipes)) {
      return false;
    }

    return true;
  }

  const [[minX, minY], [maxX, maxY]] = pipe.bbox;

  return pipeSegmentsGeoIndex.search(
    minX,
    minY,
    maxX,
    maxY,
    isValidOtherPipeSegment,
  );
}

function arePipesConnected(
  pipeAIdx: number,
  pipeBIdx: number,
  pipesLookup: PipeBufferView,
): boolean {
  const pipeA = pipesLookup.getByIndex(pipeAIdx);
  const pipeB = pipesLookup.getByIndex(pipeBIdx);

  if (!pipeA || !pipeB) {
    return false;
  }

  const pipeANodes = new Set([pipeA.startNode, pipeA.endNode]);
  return pipeANodes.has(pipeB.startNode) || pipeANodes.has(pipeB.endNode);
}

function findIntersectingPipeSegmentsForSegment(
  segmentId: number,
  currentPipeId: number,
  pipeSegments: SegmentsGeometriesBufferView,
  pipeSegmentsGeoIndex: Flatbush,
): number[] {
  function isFromCurrentPipe(index: number) {
    return pipeSegments.getId(index) === currentPipeId;
  }

  const segmentCoords = pipeSegments.getCoordinates(segmentId);
  const [segMinX, segMinY, segMaxX, segMaxY] = bbox(lineString(segmentCoords));

  return pipeSegmentsGeoIndex.search(
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
  pipeSegments: SegmentsGeometriesBufferView,
): Position[] {
  const otherPipeCoords = pipeSegments.getCoordinates(otherPipeSegmentIdx);
  const currentPipeCoords = pipeSegments.getCoordinates(currentPipeSegmentIdx);

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
  nodeGeoIndex: Flatbush,
): boolean {
  const [lon, lat] = intersectionPoint;

  const tooCloseNodeIndices = nodeGeoIndex.neighbors(
    lon,
    lat,
    1,
    distanceThreshold,
  );

  return tooCloseNodeIndices.length !== 0;
}
