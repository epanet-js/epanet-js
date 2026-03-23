// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";
import type { FeatureCollection, Position } from "geojson";
import type { Projection } from "./types";

type Bbox = [number, number, number, number];

const CHUNK_SIZE = 1000;

export const filterProjectionCandidates = async (
  projections: Projection[],
  rawGeoJson: FeatureCollection,
  bbox: Bbox,
  signal?: AbortSignal,
): Promise<Projection[]> => {
  const samplePoints = extractSamplePoints(rawGeoJson);
  if (samplePoints.length === 0) return [];

  const [minLon, minLat, maxLon, maxLat] = bbox;
  const results: Projection[] = [];

  for (let i = 0; i < projections.length; i += CHUNK_SIZE) {
    if (signal?.aborted) return results;

    const chunk = projections.slice(i, i + CHUNK_SIZE);
    for (const p of chunk) {
      try {
        const matches = samplePoints.some((point) => {
          const [lon, lat] = proj4(p.code, "EPSG:4326", [point[0], point[1]]);
          return (
            lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
          );
        });
        if (matches) results.push(p);
      } catch {
        // skip invalid projection definitions
      }
    }

    if (i + CHUNK_SIZE < projections.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return results;
};

function extractSamplePoints(
  geoJson: FeatureCollection,
  maxPoints = 10,
): Position[] {
  const points: Position[] = [];

  for (const feature of geoJson.features) {
    if (points.length >= maxPoints) break;
    if (!feature.geometry) continue;

    if (feature.geometry.type === "Point") {
      points.push(feature.geometry.coordinates);
    } else if (
      feature.geometry.type === "LineString" &&
      feature.geometry.coordinates.length > 0
    ) {
      points.push(feature.geometry.coordinates[0]);
      const last =
        feature.geometry.coordinates[feature.geometry.coordinates.length - 1];
      if (points.length < maxPoints) points.push(last);
    }
  }

  return points;
}
