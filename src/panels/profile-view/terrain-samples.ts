import { AssetsMap } from "src/hydraulic-model";
import { PathData } from "src/state/profile-view";
import { buildPathSegments, interpolateAlongPolyline } from "./path-position";

export type TerrainSample = {
  cumulativeLength: number;
  coordinates: [number, number];
};

const TARGET_SAMPLES = 250;
const MIN_SPACING_M = 5;
const MAX_SPACING_M = 200;

export function computeTerrainSamples(
  path: PathData,
  assets: AssetsMap,
): TerrainSample[] {
  if (path.totalLength <= 0 || path.linkIds.length === 0) return [];

  const segments = buildPathSegments(path, assets);
  if (segments.length === 0) return [];

  const totalLength = segments[segments.length - 1].cumulativeEnd;
  if (totalLength <= 0) return [];

  const spacing = clamp(
    totalLength / TARGET_SAMPLES,
    MIN_SPACING_M,
    MAX_SPACING_M,
  );
  const sampleCount = Math.max(2, Math.ceil(totalLength / spacing) + 1);

  const samples: TerrainSample[] = [];
  let segmentIndex = 0;
  for (let i = 0; i < sampleCount; i++) {
    const cumulativeLength =
      i === sampleCount - 1
        ? totalLength
        : (i * totalLength) / (sampleCount - 1);

    while (
      segmentIndex < segments.length - 1 &&
      cumulativeLength > segments[segmentIndex].cumulativeEnd
    ) {
      segmentIndex++;
    }

    const segment = segments[segmentIndex];
    const segmentSpan = segment.cumulativeEnd - segment.cumulativeStart;
    const fraction =
      segmentSpan > 0
        ? (cumulativeLength - segment.cumulativeStart) / segmentSpan
        : 0;
    const coordinates = interpolateAlongPolyline(
      segment.polyline,
      segment.geodesicLength,
      fraction,
    );
    samples.push({ cumulativeLength, coordinates });
  }

  return samples;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
