import { Position } from "geojson";
import measureLength from "@turf/length";
import { AssetId, AssetsMap } from "src/hydraulic-model";
import { LinkAsset } from "src/hydraulic-model/asset-types";
import { PathData } from "src/state/profile-view";

export type PathSegment = {
  cumulativeStart: number;
  cumulativeEnd: number;
  polyline: Position[];
  geodesicLength: number;
};

export function buildPathSegments(
  path: PathData,
  assets: AssetsMap,
): PathSegment[] {
  const segments: PathSegment[] = [];
  let cumulative = 0;

  for (let i = 0; i < path.linkIds.length; i++) {
    const linkId = path.linkIds[i];
    const fromNodeId = path.nodeIds[i];
    const link = assets.get(linkId);
    if (!link || !link.isLink) continue;

    const linkAsset = link as LinkAsset;
    const polyline = orientPolyline(linkAsset, fromNodeId);
    const hydraulicLength = linkAsset.length || 0;
    const geodesicLength =
      measureLength(
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: polyline },
        },
        { units: "kilometers" },
      ) * 1000;

    segments.push({
      cumulativeStart: cumulative,
      cumulativeEnd: cumulative + hydraulicLength,
      polyline,
      geodesicLength,
    });
    cumulative += hydraulicLength;
  }

  return segments;
}

function orientPolyline(link: LinkAsset, fromNodeId: AssetId): Position[] {
  const [startNodeId] = link.connections;
  const coords = link.coordinates;
  return startNodeId === fromNodeId ? coords : [...coords].reverse();
}

export function interpolateAlongPolyline(
  polyline: Position[],
  geodesicLength: number,
  fraction: number,
): [number, number] {
  if (polyline.length === 0) return [0, 0];
  if (polyline.length === 1) return [polyline[0][0], polyline[0][1]];

  const clampedFraction = clamp(fraction, 0, 1);
  if (clampedFraction <= 0) return [polyline[0][0], polyline[0][1]];
  if (clampedFraction >= 1) {
    const last = polyline[polyline.length - 1];
    return [last[0], last[1]];
  }

  const targetDistance = clampedFraction * geodesicLength;
  let traversed = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segmentLength =
      measureLength(
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [a, b] },
        },
        { units: "kilometers" },
      ) * 1000;

    if (traversed + segmentLength >= targetDistance) {
      const remaining = targetDistance - traversed;
      const t = segmentLength > 0 ? remaining / segmentLength : 0;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    traversed += segmentLength;
  }

  const last = polyline[polyline.length - 1];
  return [last[0], last[1]];
}

export function coordinatesAtLength(
  segments: PathSegment[],
  cumulativeLength: number,
): [number, number] | null {
  if (segments.length === 0) return null;
  const totalLength = segments[segments.length - 1].cumulativeEnd;
  if (cumulativeLength < 0 || cumulativeLength > totalLength) return null;

  for (const segment of segments) {
    if (cumulativeLength <= segment.cumulativeEnd) {
      const span = segment.cumulativeEnd - segment.cumulativeStart;
      const fraction =
        span > 0 ? (cumulativeLength - segment.cumulativeStart) / span : 0;
      return interpolateAlongPolyline(
        segment.polyline,
        segment.geodesicLength,
        fraction,
      );
    }
  }

  const last = segments[segments.length - 1];
  return interpolateAlongPolyline(last.polyline, last.geodesicLength, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
