import type { EncodedCrossingPipes, EncodedPipe, RunData } from "./data";
import type { Position } from "geojson";
import {
  FixedSizeBufferView,
  EncodedSize,
  decodeId,
  decodeBounds,
  decodeLinkConnections,
  decodeLineCoordinates,
} from "../shared";
import Flatbush from "flatbush";
import bbox from "@turf/bbox";
import lineIntersect from "@turf/line-intersect";
import { lineString } from "@turf/helpers";

export function findCrossingPipes(
  input: RunData,
  junctionTolerance: number,
): EncodedCrossingPipes {
  const linkConnectionsView = new FixedSizeBufferView(
    input.linksConnections,
    EncodedSize.id * 2,
    decodeLinkConnections,
  );
  const linkBoundsView = new FixedSizeBufferView(
    input.linkBounds,
    EncodedSize.bounds,
    decodeBounds,
  );
  const nodeGeoIndex = Flatbush.from(input.nodeGeoIndex);
  const pipeSegmentsGeoIndex = Flatbush.from(input.pipeSegmentsGeoIndex);
  const pipeSegmentIdsView = new FixedSizeBufferView(
    input.pipeSegmentIds,
    EncodedSize.id,
    decodeId,
  );
  const pipeSegmentCoordinatesView = new FixedSizeBufferView<
    [Position, Position]
  >(
    input.pipeSegmentCoordinates,
    EncodedSize.position * 2,
    decodeLineCoordinates,
  );

  const results: EncodedCrossingPipes = [];
  const alreadySearched = new Set<number>();
  const reportedPairs = new Set<string>();

  for (const [linkId, connections] of linkConnectionsView.enumerate()) {
    const bounds = linkBoundsView.getById(linkId);

    const currentPipe: EncodedPipe = {
      id: linkId,
      startNode: connections[0],
      endNode: connections[1],
      bbox: [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
    };

    const otherPipeSegments = findOtherPipeSegmentsNearPipe(
      currentPipe,
      alreadySearched,
      pipeSegmentIdsView,
      pipeSegmentsGeoIndex,
      linkConnectionsView,
    );

    for (const otherPipeSegmentIdx of otherPipeSegments) {
      const currentPipeSegments = findIntersectingPipeSegmentsForSegment(
        otherPipeSegmentIdx,
        currentPipe.id,
        pipeSegmentIdsView,
        pipeSegmentCoordinatesView,
        pipeSegmentsGeoIndex,
      );

      const otherPipeId = pipeSegmentIdsView.getById(otherPipeSegmentIdx);

      const pairKey = createPairKey(currentPipe.id, otherPipeId);
      if (reportedPairs.has(pairKey)) {
        continue;
      }

      let foundIntersection = false;
      for (const currentPipeSegmentIdx of currentPipeSegments) {
        const intersections = calculateIntersectionPoints(
          otherPipeSegmentIdx,
          currentPipeSegmentIdx,
          pipeSegmentCoordinatesView,
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
  pipeSegmentIdsView: FixedSizeBufferView<number>,
  pipeSegmentsGeoIndex: Flatbush,
  linksView: FixedSizeBufferView<[number, number]>,
): number[] {
  function isValidOtherPipeSegment(index: number) {
    const segmentPipeId = pipeSegmentIdsView.getById(index);
    if (segmentPipeId === pipe.id) {
      return false;
    }
    if (excludedPipes.has(segmentPipeId)) {
      return false;
    }
    if (arePipesConnected(pipe.id, segmentPipeId, linksView)) {
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
  pipeAId: number,
  pipeBId: number,
  linksView: FixedSizeBufferView<[number, number]>,
): boolean {
  const pipeAConnections = linksView.getById(pipeAId);
  const pipeBConnections = linksView.getById(pipeBId);

  return (
    pipeAConnections[0] === pipeBConnections[0] ||
    pipeAConnections[0] === pipeBConnections[1] ||
    pipeAConnections[1] === pipeBConnections[0] ||
    pipeAConnections[1] === pipeBConnections[1]
  );
}

function findIntersectingPipeSegmentsForSegment(
  segmentId: number,
  currentPipeId: number,
  pipeSegmentIdsView: FixedSizeBufferView<number>,
  pipeSegmentCoordinatesView: FixedSizeBufferView<[Position, Position]>,
  pipeSegmentsGeoIndex: Flatbush,
): number[] {
  function isFromCurrentPipe(index: number) {
    return pipeSegmentIdsView.getById(index) === currentPipeId;
  }

  const segmentCoords = pipeSegmentCoordinatesView.getById(segmentId);
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
  pipeSegmentCoordinatesView: FixedSizeBufferView<[Position, Position]>,
): Position[] {
  const otherPipeCoords =
    pipeSegmentCoordinatesView.getById(otherPipeSegmentIdx);
  const currentPipeCoords = pipeSegmentCoordinatesView.getById(
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
