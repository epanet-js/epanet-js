import { withInstrumentation } from "src/infra/with-instrumentation";
import { Asset, AssetId, LinkAsset } from "src/hydraulic-model";
import { bearing } from "@turf/bearing";
import turfLength from "@turf/length";
import turfMidpont from "@turf/midpoint";
import { Position } from "geojson";
import { IFeature } from "src/types";

export type LinkSegment = {
  midpoint: Position;
  angle: number;
  lengthInMeters: number;
  linkId: AssetId;
};
export type LinkSegmentsMap = Map<AssetId, LinkSegment[]>;
export const nullLinkSegmentsMap: LinkSegmentsMap = new Map();

export const calculateSegments = withInstrumentation(
  (
    {
      putAssets,
      deleteAssets,
    }: { putAssets: Asset[]; deleteAssets: AssetId[] },
    previousSegments: LinkSegmentsMap = new Map(),
  ) => {
    const segments = new Map(Array.from(previousSegments));
    deleteAssets.forEach((assetId) => {
      segments.delete(assetId);
    });
    putAssets.forEach((wrappedFeature) => {
      const asset = wrappedFeature as unknown as Asset;
      if (asset.type !== "pipe") return;

      const linkSegments: LinkSegment[] = [];
      for (const segmentCoordinates of (asset as LinkAsset).segments) {
        const [start, end] = segmentCoordinates;
        linkSegments.push({
          midpoint: turfMidpont(start, end).geometry.coordinates,
          angle: calculateAngle(segmentCoordinates),
          lengthInMeters: measureSegment(segmentCoordinates),
          linkId: asset.id,
        });
      }
      segments.set(asset.id, linkSegments);
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
