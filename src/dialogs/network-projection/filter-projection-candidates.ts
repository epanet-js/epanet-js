// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";
import type { FeatureCollection, Position } from "geojson";
import type { Bbox, Projection, ProjectionCandidate } from "./types";

const CHUNK_SIZE = 1000;

export const buildProjectionCandidates = async (
  projections: Projection[],
  rawGeoJson: FeatureCollection,
  signal?: AbortSignal,
): Promise<ProjectionCandidate[]> => {
  const dataBbox = computeRawBbox(rawGeoJson);
  if (!dataBbox) return [];

  const corners: [number, number][] = [
    [dataBbox[0], dataBbox[1]],
    [dataBbox[2], dataBbox[1]],
    [dataBbox[2], dataBbox[3]],
    [dataBbox[0], dataBbox[3]],
  ];

  const results: ProjectionCandidate[] = [];

  for (let i = 0; i < projections.length; i += CHUNK_SIZE) {
    if (signal?.aborted) return results;

    const chunk = projections.slice(i, i + CHUNK_SIZE);
    for (const p of chunk) {
      try {
        let minLon = Infinity;
        let minLat = Infinity;
        let maxLon = -Infinity;
        let maxLat = -Infinity;
        let valid = true;

        for (const corner of corners) {
          const [lon, lat] = proj4(p.code, "EPSG:4326", [corner[0], corner[1]]);
          if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
            valid = false;
            break;
          }
          if (lon < minLon) minLon = lon;
          if (lat < minLat) minLat = lat;
          if (lon > maxLon) maxLon = lon;
          if (lat > maxLat) maxLat = lat;
        }

        if (valid) {
          results.push({
            projection: p,
            projectedBbox: [minLon, minLat, maxLon, maxLat],
          });
        }
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

export const filterByViewport = (
  candidates: ProjectionCandidate[],
  viewport: Bbox,
): ProjectionCandidate[] => {
  return candidates.filter((c) => bboxOverlaps(c.projectedBbox, viewport));
};

function bboxOverlaps(a: Bbox, b: Bbox): boolean {
  return a[2] >= b[0] && a[0] <= b[2] && a[3] >= b[1] && a[1] <= b[3];
}

function computeRawBbox(geoJson: FeatureCollection): Bbox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  const update = (coord: Position) => {
    found = true;
    if (coord[0] < minX) minX = coord[0];
    if (coord[1] < minY) minY = coord[1];
    if (coord[0] > maxX) maxX = coord[0];
    if (coord[1] > maxY) maxY = coord[1];
  };

  for (const feature of geoJson.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === "Point") {
      update(feature.geometry.coordinates);
    } else if (feature.geometry.type === "LineString") {
      feature.geometry.coordinates.forEach(update);
    }
  }

  return found ? [minX, minY, maxX, maxY] : null;
}
