import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { IssueCollector, type ZoneData } from "@epanet-js/converters";
import type { GisInput, ImportOptions, ImportResult } from "../importer";
import type { ImportConfig } from "../import-config";
import { parseGisSource } from "../file-parsers/parse-gis-source";
import { createTimeSlicer, throwIfAborted } from "../time-slice";

export type ZoneRole = "label";

// A zone carries whole rings rather than one coordinate, so its records cost far
// more than a point's and fewer of them fit in a slice.
const RECORDS_PER_BATCH = 256;

export const importZonesFromFeatures = async (
  features: Feature[],
  config: ImportConfig<ZoneRole> = {},
  { signal }: ImportOptions = {},
): Promise<ImportResult> => {
  throwIfAborted(signal);

  const issues = new IssueCollector();
  const collected = issues.build();

  const labelProperty = config.mapping?.label ?? null;
  const limit = config.recordLimit ?? features.length;

  const zones: ZoneData[] = [];

  const end = Math.min(features.length, limit);
  const sliceIfDue = createTimeSlicer();

  for (let start = 0; start < end; start += RECORDS_PER_BATCH) {
    const stop = Math.min(start + RECORDS_PER_BATCH, end);

    for (let index = start; index < stop; index++) {
      const zone = importFeature(
        features[index],
        String(index),
        labelProperty,
        issues,
      );
      if (zone !== null) zones.push(zone);
    }

    await sliceIfDue();
    throwIfAborted(signal);
  }

  return { network: { zones }, issues: collected };
};

export const importZonesFromSource = async (
  input: GisInput & ImportOptions & { config?: ImportConfig<ZoneRole> },
): Promise<ImportResult> => {
  const { features, issues } = await parseGisSource(input);
  const parsed = issues.build();

  if (features.length === 0) return { network: {}, issues: parsed };

  const placed = !parsed.some(({ severity }) => severity === "error");
  const { network, issues: interpreted } = await importZonesFromFeatures(
    features,
    input.config ?? {},
    { signal: input.signal },
  );

  return {
    network: {
      ...network,
      crs: placed ? { type: "epsg", code: 4326 } : { type: "unknown" },
    },
    issues: [...parsed, ...interpreted],
  };
};

const importFeature = (
  feature: Feature,
  ref: string,
  labelProperty: string | null,
  issues: IssueCollector,
): ZoneData | null => {
  const geometry = feature.geometry;

  if (!geometry) {
    issues.add({
      code: "featureGeometryMissing",
      severity: "warning",
      ref,
      raw: feature,
    });
    return null;
  }

  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    issues.add({
      code: "featureGeometryUnsupported",
      severity: "warning",
      ref,
      context: { geometry: geometry.type },
      raw: feature,
    });
    return null;
  }

  const polygons = readPolygons(geometry);
  if (typeof polygons === "string") {
    issues.add({
      code:
        polygons === "coordinatesInvalid"
          ? "featureCoordinatesInvalid"
          : "zoneGeometryUnreadable",
      severity: "warning",
      ref,
      raw: feature,
    });
    return null;
  }

  const zone: ZoneData = { ref, polygons };

  const label = readLabel(feature, labelProperty);
  if (label !== null) zone.label = label;

  return zone;
};

type GeometryProblem = "coordinatesInvalid" | "geometryUnreadable";

const CLOSED_RING_POSITIONS = 4;

const readPolygons = (
  geometry: Polygon | MultiPolygon,
): Position[][][] | GeometryProblem => {
  const source =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const polygons: Position[][][] = [];

  for (const polygon of source) {
    const rings: Position[][] = [];

    for (const ring of polygon) {
      if (!Array.isArray(ring)) return "geometryUnreadable";
      if (!ring.every(isFinitePosition)) return "coordinatesInvalid";

      const closed = close(ring);
      if (closed.length < CLOSED_RING_POSITIONS) return "geometryUnreadable";

      rings.push(closed);
    }

    if (rings.length === 0) return "geometryUnreadable";
    polygons.push(rings);
  }

  return polygons.length === 0 ? "geometryUnreadable" : polygons;
};

const isFinitePosition = (position: Position): boolean =>
  Array.isArray(position) &&
  position.length >= 2 &&
  Number.isFinite(position[0]) &&
  Number.isFinite(position[1]);

const close = (ring: Position[]): Position[] => {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;

  return [...ring, [...first]];
};

const readLabel = (
  feature: Feature,
  property: string | null,
): string | null => {
  if (property === null) return null;

  const value: unknown = feature.properties?.[property];
  if (value === null || value === undefined || value === "") return null;

  return String(value);
};
