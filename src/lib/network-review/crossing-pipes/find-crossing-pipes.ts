import type { EncodedCrossingPipes, RunData } from "./data";
import {
  PipeBufferView,
  NodeBufferView,
  SegmentsGeometriesBufferView,
} from "./data";
import type { Feature, LineString, Position } from "geojson";
import Flatbush from "flatbush";
import bbox from "@turf/bbox";
import lineIntersect from "@turf/line-intersect";
import distance from "@turf/distance";
import { lineString, point } from "@turf/helpers";

export function findCrossingPipes(
  input: RunData,
  junctionTolerance: number = 0.5,
): EncodedCrossingPipes {
  const pipeData = new PipeBufferView(input.pipeBuffer);
  const nodeGeoIndex = Flatbush.from(input.nodeGeoIndex);
  const nodeData = new NodeBufferView(input.nodeBuffer);
  const pipeSegmentsGeoIndex = Flatbush.from(input.pipeSegmentsGeoIndex);
  const pipeSegmentsLookup = new SegmentsGeometriesBufferView(
    input.pipeSegmentsBuffer,
  );

  const pipes = Array.from(pipeData.pipes());
  if (pipes.length < 2) {
    return [];
  }

  const nodes = Array.from(nodeData.nodes());

  const pipeConnections = new Map<number, Set<number>>();
  for (const pipe of pipes) {
    if (!pipeConnections.has(pipe.startNode)) {
      pipeConnections.set(pipe.startNode, new Set());
    }
    if (!pipeConnections.has(pipe.endNode)) {
      pipeConnections.set(pipe.endNode, new Set());
    }
    pipeConnections.get(pipe.startNode)!.add(pipe.id);
    pipeConnections.get(pipe.endNode)!.add(pipe.id);
  }

  const results: EncodedCrossingPipes = [];
  const processedPairs = new Set<string>();

  for (let i = 0; i < pipeSegmentsLookup.count; i++) {
    const segment1PipeId = pipeSegmentsLookup.getId(i);
    const segment1Coords = pipeSegmentsLookup.getCoordinates(i);
    const segment1Line = lineString(segment1Coords);
    const [minX, minY, maxX, maxY] = bbox(segment1Line);

    const candidateIndices = pipeSegmentsGeoIndex.search(
      minX,
      minY,
      maxX,
      maxY,
    );

    for (const j of candidateIndices) {
      const segment2PipeId = pipeSegmentsLookup.getId(j);

      if (segment1PipeId >= segment2PipeId) continue;

      const pairKey = `${segment1PipeId}-${segment2PipeId}`;
      if (processedPairs.has(pairKey)) continue;

      const pipe1 = pipes.find((p) => p.id === segment1PipeId);
      const pipe2 = pipes.find((p) => p.id === segment2PipeId);

      if (!pipe1 || !pipe2) continue;

      if (
        pipe1.startNode === pipe2.startNode ||
        pipe1.startNode === pipe2.endNode ||
        pipe1.endNode === pipe2.startNode ||
        pipe1.endNode === pipe2.endNode
      ) {
        continue;
      }

      const segment2Coords = pipeSegmentsLookup.getCoordinates(j);
      const segment2Line = lineString(segment2Coords);

      const intersections = lineIntersect(
        segment1Line as Feature<LineString>,
        segment2Line as Feature<LineString>,
      );

      for (const intersection of intersections.features) {
        if (intersection.geometry.type === "Point") {
          const intersectionPoint = intersection.geometry.coordinates as [
            number,
            number,
          ];

          const distanceToNearestJunction = findDistanceToNearestJunction(
            intersectionPoint,
            nodeGeoIndex,
            nodes,
          );

          if (distanceToNearestJunction > junctionTolerance) {
            processedPairs.add(pairKey);
            results.push({
              pipe1Id: segment1PipeId,
              pipe2Id: segment2PipeId,
              intersectionPoint,
              distanceToNearestJunction,
            });
            break;
          }
        }
      }
    }
  }

  return results;
}

function findDistanceToNearestJunction(
  intersectionPoint: Position,
  nodeGeoIndex: Flatbush,
  nodes: Array<{ id: number; position: Position }>,
): number {
  const [lon, lat] = intersectionPoint;

  const nearestNodeIndices = nodeGeoIndex.neighbors(lon, lat, 1);

  if (nearestNodeIndices.length === 0) {
    return Infinity;
  }

  const nearestNodeIndex = nearestNodeIndices[0];
  const nearestNode = nodes[nearestNodeIndex];

  if (!nearestNode) {
    return Infinity;
  }

  return distance(point(intersectionPoint), point(nearestNode.position), {
    units: "meters",
  });
}
