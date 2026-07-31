import { Unit, convertTo } from "@epanet-js/quantity";
import {
  fetchElevationForPoint,
  fetchElevationsForPoints,
  type LngLat,
} from "./tile-server-elevation";
import type { ElevationSource } from "./elevation-source-types";
import {
  fetchGeoTiffTileElevation,
  fetchGeoTiffTileElevationsForPoints,
  isPointInBbox,
  type GeoTiffElevation,
} from "./geotiff/fetch-elevation";

/** What the fetch is working on right now, for a live status line. */
export type ElevationFetchStatus =
  | { kind: "tile-server"; completed: number; total: number }
  | { kind: "geotiff"; fileName: string };

export type FetchElevationsOptions = {
  /** Cumulative resolved points against the total, as tiles/buckets complete. */
  onProgress?: (resolved: number, total: number) => void;
  /** The tile/file currently being processed, so a stall is legible. */
  onStatus?: (status: ElevationFetchStatus) => void;
  /** Aborts between tiles/buckets; already-resolved points are kept. */
  signal?: AbortSignal;
  /**
   * Called if a source fails. The fetch resolves with whatever was already
   * resolved (like an abort) rather than rejecting, so partial work is kept.
   */
  onError?: (error: unknown) => void;
};

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
 *
 * Because each source only sees the points still unresolved after the previous
 * ones, resolved counts partition cleanly across sources: `total` is simply
 * `points.length` and `onProgress` reports resolved points as tiles/buckets
 * complete. Points no source covers stay `null`, so progress can legitimately
 * finish below `total` — the uncovered remainder. `onStatus` reports the tile or
 * file currently being processed.
 */
export async function fetchElevationsFromSources(
  sources: ElevationSource[],
  points: LngLat[],
  unit: Unit,
  options?: FetchElevationsOptions,
): Promise<(number | null)[]> {
  const results: (number | null)[] = new Array(points.length).fill(null);

  const total = points.length;
  let resolved = 0;
  const onResolved = options?.onProgress
    ? (count: number) => {
        resolved += count;
        options.onProgress!(resolved, total);
      }
    : undefined;
  options?.onProgress?.(0, total);

  // A source failure stops the run like an abort: keep partial results, report
  // the error, and don't fall through to the next source.
  let fetchError: unknown = null;
  const onError = (error: unknown) => {
    fetchError = error;
  };

  for (let i = sources.length - 1; i >= 0; i--) {
    if (options?.signal?.aborted || fetchError !== null) break;
    const source = sources[i];
    if (!source.enabled) continue;

    const unresolvedIndices: number[] = [];
    for (let j = 0; j < results.length; j++) {
      if (results[j] === null) unresolvedIndices.push(j);
    }
    if (unresolvedIndices.length === 0) break;

    const unresolvedPoints = unresolvedIndices.map((idx) => points[idx]);
    const sourceResults = await trySourceBatch(
      source,
      unresolvedPoints,
      unit,
      onResolved,
      options?.onStatus,
      options?.signal,
      onError,
    );

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

  if (fetchError !== null) options?.onError?.(fetchError);

  return results;
}

async function trySourceBatch(
  source: ElevationSource,
  points: LngLat[],
  unit: Unit,
  onResolved?: (count: number) => void,
  onStatus?: (status: ElevationFetchStatus) => void,
  signal?: AbortSignal,
  onError?: (error: unknown) => void,
): Promise<(number | null)[]> {
  switch (source.type) {
    case "geotiff":
      return tryGeotiffSourceBatch(
        source,
        points,
        unit,
        onResolved,
        onStatus,
        signal,
        onError,
      );
    case "tile-server":
      try {
        return await fetchElevationsForPoints(points, {
          unit,
          tileServer: source,
          onResolved,
          onTileProgress: onStatus
            ? (completed, tileTotal) =>
                onStatus({ kind: "tile-server", completed, total: tileTotal })
            : undefined,
          signal,
        });
      } catch (error) {
        onError?.(error);
        return points.map(() => null);
      }
  }
}

/**
 * For each tile in source order, collects the still-unresolved points whose
 * bbox contains them and issues a single bulk read against that tile. Within
 * a source, earlier tiles take priority on overlap (matches single-point
 * `tryGeotiffSource`).
 */
async function tryGeotiffSourceBatch(
  source: Extract<ElevationSource, { type: "geotiff" }>,
  points: LngLat[],
  unit: Unit,
  onResolved?: (count: number) => void,
  onStatus?: (status: ElevationFetchStatus) => void,
  signal?: AbortSignal,
  onError?: (error: unknown) => void,
): Promise<(number | null)[]> {
  const results: (number | null)[] = new Array(points.length).fill(null);

  for (const tile of source.tiles) {
    if (signal?.aborted) break;
    const candidates: { index: number; point: LngLat }[] = [];
    for (let i = 0; i < points.length; i++) {
      if (results[i] !== null) continue;
      const p = points[i];
      if (isPointInBbox(p.lng, p.lat, tile.bbox)) {
        candidates.push({ index: i, point: p });
      }
    }
    if (candidates.length === 0) continue;

    onStatus?.({ kind: "geotiff", fileName: tile.file.name });

    let tileResults: (GeoTiffElevation | null)[];
    try {
      tileResults = await fetchGeoTiffTileElevationsForPoints(
        tile,
        candidates.map((c) => c.point),
        onResolved,
        signal,
      );
    } catch (error) {
      // Keep the tiles read before this one; stop this source.
      onError?.(error);
      break;
    }
    for (let k = 0; k < candidates.length; k++) {
      const elevation = tileResults[k];
      if (elevation !== null) {
        results[candidates[k].index] = parseFloat(
          convertTo(elevation, unit).toFixed(2),
        );
      }
    }
  }

  return results;
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
