import { Unit, convertTo } from "src/quantity";
import {
  fetchElevationForPoint,
  fetchElevationsForPoints,
  type LngLat,
} from "./tile-server-elevation";
import type { ElevationSource } from "./elevation-source-types";
import {
  fetchGeoTiffTileElevation,
  isPointInBbox,
} from "./geotiff/fetch-elevation";

/**
 * Iterates elevation sources in reverse order (last = highest priority)
 * and returns the first valid elevation converted to the requested unit,
 * or null if none found.
 *
 * Supports both GeoTIFF and tile-server sources in any order.
 */
export async function fetchElevationFromSources(
  sources: ElevationSource[],
  lng: number,
  lat: number,
  unit: Unit,
): Promise<number | null> {
  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i];
    if (!source.enabled) continue;

    const elevation = await trySource(source, lng, lat, unit);
    if (elevation !== null) {
      const offsetInUnit = convertTo(
        { value: source.elevationOffsetM, unit: "m" },
        unit,
      );
      return elevation + offsetInUnit;
    }
  }

  return null;
}

/**
 * Batched variant. Iterates sources in reverse order (last = highest priority),
 * filling unresolved points from each source. Tile-server sources decode each
 * unique tile only once per call, so N points sharing K tiles cost K decodes.
 */
export async function fetchElevationsFromSources(
  sources: ElevationSource[],
  points: LngLat[],
  unit: Unit,
): Promise<(number | null)[]> {
  const results: (number | null)[] = new Array(points.length).fill(null);

  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i];
    if (!source.enabled) continue;

    const unresolvedIndices: number[] = [];
    for (let j = 0; j < results.length; j++) {
      if (results[j] === null) unresolvedIndices.push(j);
    }
    if (unresolvedIndices.length === 0) break;

    const unresolvedPoints = unresolvedIndices.map((idx) => points[idx]);
    const sourceResults = await trySourceBatch(source, unresolvedPoints, unit);

    const offsetInUnit = convertTo(
      { value: source.elevationOffsetM, unit: "m" },
      unit,
    );
    for (let k = 0; k < unresolvedIndices.length; k++) {
      const elevation = sourceResults[k];
      if (elevation !== null) {
        results[unresolvedIndices[k]] = elevation + offsetInUnit;
      }
    }
  }

  return results;
}

async function trySourceBatch(
  source: ElevationSource,
  points: LngLat[],
  unit: Unit,
): Promise<(number | null)[]> {
  switch (source.type) {
    case "geotiff": {
      const out: (number | null)[] = new Array(points.length).fill(null);
      for (let i = 0; i < points.length; i++) {
        out[i] = await tryGeotiffSource(
          source,
          points[i].lng,
          points[i].lat,
          unit,
        );
      }
      return out;
    }
    case "tile-server":
      try {
        return await fetchElevationsForPoints(points, {
          unit,
          tileServer: source,
        });
      } catch {
        return points.map(() => null);
      }
  }
}

async function trySource(
  source: ElevationSource,
  lng: number,
  lat: number,
  unit: Unit,
): Promise<number | null> {
  switch (source.type) {
    case "geotiff":
      return tryGeotiffSource(source, lng, lat, unit);
    case "tile-server":
      return tryTileServerSource(source, lng, lat, unit);
  }
}

async function tryGeotiffSource(
  source: Extract<ElevationSource, { type: "geotiff" }>,
  lng: number,
  lat: number,
  unit: Unit,
): Promise<number | null> {
  for (const tile of source.tiles) {
    if (!isPointInBbox(lng, lat, tile.bbox)) continue;

    const elevation = await fetchGeoTiffTileElevation(tile, lng, lat);

    if (elevation !== null)
      return parseFloat(convertTo(elevation, unit).toFixed(2));
  }
  return null;
}

async function tryTileServerSource(
  source: Extract<ElevationSource, { type: "tile-server" }>,
  lng: number,
  lat: number,
  unit: Unit,
): Promise<number | null> {
  try {
    return await fetchElevationForPoint(
      { lng, lat },
      {
        unit,
        tileServer: source,
      },
    );
  } catch {
    return null;
  }
}
