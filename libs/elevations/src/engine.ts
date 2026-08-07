import { Unit, convertTo } from "@epanet-js/quantity";
import type {
  BoundaryResult,
  ElevationSource,
  FetchElevationsOptions,
  FetchProj4Def,
  GeoTiffTile,
  LngLat,
  TileCoverageOptions,
  TileServerElevationSource,
} from "./types";
import { fetchElevationForPoint, prefetchElevationsTile } from "./tile-server";

export interface ElevationEngine {
  fetchElevation(
    sources: ElevationSource[],
    lng: number,
    lat: number,
    unit: Unit,
  ): Promise<number | null>;
  fetchElevations(
    sources: ElevationSource[],
    points: LngLat[],
    unit: Unit,
    options?: FetchElevationsOptions,
  ): Promise<(number | null)[]>;
  prefetchTile(
    lngLat: LngLat,
    source: TileServerElevationSource,
  ): Promise<void>;
  supportsGeoTiff: boolean;
  geoTiff: ElevationGeoTiffCapability;
}

export interface ElevationGeoTiffCapability {
  parse(
    file: File,
    fetchProj4Def: FetchProj4Def,
  ): Promise<Omit<GeoTiffTile, "id">>;
  computeBoundaries(
    tiles: GeoTiffTile[],
    onResult: (result: BoundaryResult) => void,
    isCancelled: (tileId: string) => boolean,
  ): Promise<void>;
  coverage(tile: GeoTiffTile, options: TileCoverageOptions): GeoJSON.Feature;
  resolution(tile: GeoTiffTile): { value: number; unit: "m" | "ft" };
}

const unsupportedError = () =>
  new Error("This elevation engine does not support GeoTIFF sources");

const unsupported = (): never => {
  throw unsupportedError();
};

const inertGeoTiff: ElevationGeoTiffCapability = {
  // Rejects rather than throwing synchronously: callers await this.
  parse: () => Promise.reject(unsupportedError()),
  computeBoundaries: () => Promise.resolve(),
  coverage: unsupported,
  resolution: unsupported,
};

async function fetchElevation(
  sources: ElevationSource[],
  lng: number,
  lat: number,
  unit: Unit,
): Promise<number | null> {
  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i];
    if (!source.enabled) continue;
    if (source.type !== "tile-server") continue;

    let elevation: number | null;
    try {
      elevation = await fetchElevationForPoint(
        { lng, lat },
        { unit, tileServer: source },
      );
    } catch {
      elevation = null;
    }

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

function fetchElevations(
  _sources: ElevationSource[],
  points: LngLat[],
): Promise<(number | null)[]> {
  return Promise.resolve(points.map(() => null));
}

export const defaultElevationEngine: ElevationEngine = {
  fetchElevation,
  fetchElevations,
  prefetchTile: (lngLat, source) => prefetchElevationsTile(lngLat, source),
  supportsGeoTiff: false,
  geoTiff: inertGeoTiff,
};
