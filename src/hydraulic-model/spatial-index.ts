import { LineString, Feature } from "@turf/helpers";
import lineSegment from "@turf/line-segment";
import bbox from "@turf/bbox";
import Flatbush from "flatbush";
import { Link } from "./asset-types/link";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { AssetId } from "./asset-types/base-asset";

export interface LinkSegmentProperties {
  linkId: AssetId;
}

export type LinkSegment = Feature<LineString, LinkSegmentProperties>;

export interface SpatialIndexData {
  spatialIndex: Flatbush | null;
  segments: LinkSegment[];
}

export const createSpatialIndex = withDebugInstrumentation(
  function createSpatialIndex(links: Link<any>[]): SpatialIndexData {
    if (links.length === 0) {
      return { spatialIndex: null, segments: [] };
    }

    const allSegments: LinkSegment[] = [];

    for (const link of links) {
      if (link.feature.geometry.type === "LineString") {
        const linkFeature = {
          type: "Feature" as const,
          geometry: link.feature.geometry as LineString,
          properties: { linkId: link.id },
        };
        const segments = lineSegment(linkFeature);
        for (const segment of segments.features) {
          const linkSegment: LinkSegment = {
            ...segment,
            properties: {
              linkId: link.id,
            },
          };
          allSegments.push(linkSegment);
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
