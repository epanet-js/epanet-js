import { withInstrumentation } from "src/infra/with-instrumentation";
import { SegmentData, SegmentsData } from "./overlays/flows";
import { Asset, AssetId, LinkAsset } from "src/hydraulic-model";
import { bearing } from "@turf/bearing";
import turfLength from "@turf/length";
import turfMidpont from "@turf/midpoint";
import { Position } from "geojson";
import { IFeature } from "src/types";

export const calculateSegments = withInstrumentation(
  (
    previousSegments: SegmentsData,
    putAssets: Asset[],
    deleteAssets: AssetId[],
  ) => {
    const segments = new Map(Array.from(previousSegments));
    deleteAssets.forEach((assetId) => {
      segments.delete(assetId);
    });
    putAssets.forEach((wrappedFeature) => {
      const asset = wrappedFeature as unknown as Asset;
      if (asset.type !== "pipe") return;

      const assetSegments: SegmentData[] = [];
      for (const segmentCoordinates of (asset as LinkAsset).segments) {
        const [start, end] = segmentCoordinates;
        assetSegments.push({
          midpoint: turfMidpont(start, end).geometry.coordinates,
          coordinates: [start, end],
          angle: calculateAngle(segmentCoordinates),
          lengthInMeters: measureSegment(segmentCoordinates),
          assetId: asset.id,
        });
      }
      segments.set(asset.id, assetSegments);
    });
    return segments;
  },
  { name: "MAP_STATE:UPDATE_SEGMENTS_DATA", maxDurationMs: 1000 },
);

const calculateAngle = (segmentCoordinates: Position[]): number => {
  const angleFromNorth = bearing(segmentCoordinates[0], segmentCoordinates[1]);
  const angleFromEast = (90 - angleFromNorth + 360) % 360;
  return angleFromEast;
};

const measureSegment = (coordinates: Position[]) => {
  return (
    turfLength({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: coordinates,
      },
    } as IFeature) * 1000
  );
};
