import { LineString, Feature } from "@turf/helpers";
import lineSegment from "@turf/line-segment";
import bbox from "@turf/bbox";
import Flatbush from "flatbush";
import { Pipe } from "./asset-types/pipe";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";

export interface SpatialIndexData {
  spatialIndex: Flatbush | null;
  segments: Feature<LineString>[];
}

export const createSpatialIndex = withDebugInstrumentation(
  function createSpatialIndex(pipes: Pipe[]): SpatialIndexData {
    if (pipes.length === 0) {
      return { spatialIndex: null, segments: [] };
    }

    const allSegments: Feature<LineString>[] = [];

    for (const pipe of pipes) {
      if (pipe.feature.geometry.type === "LineString") {
        const pipeFeature = {
          type: "Feature" as const,
          geometry: pipe.feature.geometry as LineString,
          properties: { pipeId: pipe.id },
        };
        const segments = lineSegment(pipeFeature);
        for (const segment of segments.features) {
          segment.properties = {
            ...segment.properties,
            pipeId: pipe.id,
          };
          allSegments.push(segment);
        }
      }
    }

    if (allSegments.length === 0) {
      return { spatialIndex: null, segments: [] };
    }

    const spatialIndex = new Flatbush(allSegments.length);

    for (const segment of allSegments) {
      const [minX, minY, maxX, maxY] = bbox(segment);
      spatialIndex.add(minX, minY, maxX, maxY);
    }

    spatialIndex.finish();
    return { spatialIndex, segments: allSegments };
  },
  {
    name: "createSpatialIndex",
    maxDurationMs: 10000,
  },
);
