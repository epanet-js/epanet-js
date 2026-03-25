import { Unit, convertTo } from "src/quantity";
import { fetchElevationForPoint } from "./tile-server-elevation";
import { sampleElevation, isPointInBbox } from "./geotiff-utils";
import type { ElevationSource } from "./elevation-source-types";

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
      return tryTileServerSource(lng, lat, unit);
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

    const elevation = await sampleElevation(tile, lng, lat, unit);
    if (elevation !== null) return elevation;
  }
  return null;
}

async function tryTileServerSource(
  lng: number,
  lat: number,
  unit: Unit,
): Promise<number | null> {
  try {
    return await fetchElevationForPoint({ lng, lat }, { unit });
  } catch {
    return null;
  }
}
