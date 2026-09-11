import type { Feature, FeatureCollection } from "geojson";
import shp from "shpjs";
import {
  convertGeoJsonToWGS84,
  extractEPSGFromGeoJSON,
  findProjectionByCode,
  isLikelyLatLng,
  type Proj4Projection,
} from "@epanet-js/projections";
import {
  IssueCollector,
  type Issue,
  type SourceFile,
} from "@epanet-js/converters";
import type { GisInput } from "../importer";

export type ParsedGisSource = {
  features: Feature[];
  originalProjection?: string;
  issues: IssueCollector;
};

type DecodedSource = {
  features: Feature[];
  originalProjection?: string;
  issues: Issue[];
};

type CacheEntry = {
  files: SourceFile[];
  suppliedEpsg: number | null;
  decoded: DecodedSource;
};
const cache = new WeakMap<SourceFile, CacheEntry>();

const suppliedEpsg = (crs: GisInput["crs"]): number | null =>
  crs?.type === "epsg" ? crs.code : null;

const sameInput = (
  entry: CacheEntry,
  files: SourceFile[],
  epsg: number | null,
): boolean =>
  entry.suppliedEpsg === epsg &&
  entry.files.length === files.length &&
  entry.files.every((file, index) => file === files[index]);

export const parseGisSource = async (
  input: GisInput,
): Promise<ParsedGisSource> => {
  const { files } = input;
  const key = files[0];
  if (key === undefined) return resultOf(failure("sourceEmpty"));

  const epsg = suppliedEpsg(input.crs);
  const cached = cache.get(key);
  if (cached && sameInput(cached, files, epsg)) return resultOf(cached.decoded);

  const decoded = await decode(input);
  cache.set(key, { files, suppliedEpsg: epsg, decoded });
  return resultOf(decoded);
};

const resultOf = (decoded: DecodedSource): ParsedGisSource => {
  const issues = new IssueCollector();
  for (const issue of decoded.issues) issues.add(issue);

  return {
    features: decoded.features,
    ...(decoded.originalProjection === undefined
      ? {}
      : { originalProjection: decoded.originalProjection }),
    issues,
  };
};

const failure = (
  code:
    | "sourceEmpty"
    | "sourceUnreadable"
    | "sourceFilesIncomplete"
    | "coordinateSystemUnsupported"
    | "coordinateSystemMismatch",
): DecodedSource => ({
  features: [],
  issues: [{ code, severity: "error" }],
});

const SHAPEFILE_SIDECARS = [".dbf", ".prj", ".cpg", ".shx"];

const hasExtension = (file: SourceFile, extension: string) =>
  file.name.toLowerCase().endsWith(extension);

const decode = async (input: GisInput): Promise<DecodedSource> => {
  const { files } = input;
  const shpFile = files.find((file) => hasExtension(file, ".shp"));
  if (shpFile) return parseShapefile(files, shpFile, input);

  const primary = files.find(
    (file) =>
      !SHAPEFILE_SIDECARS.some((extension) => hasExtension(file, extension)),
  );
  if (primary === undefined) return failure("sourceFilesIncomplete");

  return parseGeoJson(primary, input);
};

const parseShapefile = async (
  files: SourceFile[],
  shpFile: SourceFile,
  { crs, projections }: GisInput,
): Promise<DecodedSource> => {
  const byExtension = (extension: string) =>
    files.find((file) => hasExtension(file, extension));

  const dbf = byExtension(".dbf");
  const prj = byExtension(".prj");
  const cpg = byExtension(".cpg");

  const input: {
    shp: ArrayBuffer;
    dbf?: ArrayBuffer;
    prj?: string;
    cpg?: string;
  } = { shp: await shpFile.arrayBuffer() };
  if (dbf) input.dbf = await dbf.arrayBuffer();
  if (prj) input.prj = await textOf(prj);
  if (cpg) input.cpg = await textOf(cpg);

  let collection: FeatureCollection;
  try {
    collection = await shp(input);
  } catch {
    return failure("sourceUnreadable");
  }

  const features = collection.features ?? [];
  if (features.length === 0) return failure("sourceEmpty");

  if (input.prj === undefined) {
    return placeFeatures({ features, epsg: suppliedEpsg(crs), projections });
  }

  if (!mostlyLatLng(features)) return failure("coordinateSystemMismatch");

  const authoredIn = crsNameFromWkt(input.prj);

  return {
    features,
    ...(authoredIn === null ? {} : { originalProjection: authoredIn }),
    issues: [],
  };
};

const WGS84_WKT_NAMES = new Set(["gcs_wgs_1984", "wgs 84", "wgs84"]);

const crsNameFromWkt = (wkt: string): string | null => {
  const name = /^(?:PROJCS|GEOGCS)\["([^"]+)"/.exec(wkt)?.[1];
  if (name === undefined) return null;

  return WGS84_WKT_NAMES.has(name.toLowerCase()) ? null : name;
};

const parseGeoJson = async (
  file: SourceFile,
  { crs, projections }: GisInput,
): Promise<DecodedSource> => {
  const parsed = featuresFromText(await textOf(file));
  if (parsed === null) return failure("sourceUnreadable");
  if (parsed.features.length === 0) return failure("sourceEmpty");

  return placeFeatures({
    features: parsed.features,
    epsg: parsed.stated ?? suppliedEpsg(crs),
    projections,
  });
};

type Placement = {
  features: Feature[];
  epsg: number | null;
  projections?: Map<string, Proj4Projection>;
};

const placeFeatures = ({
  features,
  epsg,
  projections,
}: Placement): DecodedSource => {
  if (epsg === null || epsg === WGS84_EPSG) {
    if (!mostlyLatLng(features)) {
      if (epsg !== null) return failure("coordinateSystemMismatch");

      return {
        features,
        issues: [{ code: "coordinateSystemUnknown", severity: "error" }],
      };
    }

    return {
      features,
      issues:
        epsg === null
          ? [{ code: "coordinateSystemMissing", severity: "warning" }]
          : [],
    };
  }

  const projection = findProjectionByCode(
    String(epsg),
    projections ?? new Map<string, Proj4Projection>(),
  );
  if (projection === null) return failure("coordinateSystemUnsupported");

  let converted: FeatureCollection;
  try {
    converted = convertGeoJsonToWGS84(
      { type: "FeatureCollection", features },
      projection.code,
    );
  } catch {
    return failure("coordinateSystemMismatch");
  }

  return mostlyLatLng(converted.features)
    ? {
        features: converted.features,
        originalProjection: projection.name,
        issues: [],
      }
    : failure("coordinateSystemMismatch");
};

const WGS84_EPSG = 4326;

type ParsedGeoJson = { features: Feature[]; stated: number | null };

const featuresFromText = (content: string): ParsedGeoJson | null => {
  const trimmed = content.trim();
  const collection = asFeatureCollection(trimmed);

  if (collection !== null) {
    return {
      features: collection.features ?? [],
      stated: statedCrs(collection),
    };
  }

  return asFeatureLines(trimmed);
};

const asFeatureCollection = (content: string): FeatureCollection | null => {
  if (!content.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(content) as FeatureCollection;
    return parsed.type === "FeatureCollection" ? parsed : null;
  } catch {
    return null;
  }
};

const asFeatureLines = (content: string): ParsedGeoJson | null => {
  const features: Feature[] = [];

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const candidate = JSON.parse(line) as Feature;
      if (candidate.type === "Feature") features.push(candidate);
    } catch {
      continue;
    }
  }

  return features.length === 0 ? null : { features, stated: null };
};

const statedCrs = (collection: FeatureCollection): number | null => {
  const { code } = extractEPSGFromGeoJSON(collection);
  return code === null ? null : Number(code);
};

const mostlyLatLng = (features: Feature[]): boolean => {
  const located = features.filter((feature) => feature.geometry);
  if (located.length === 0) return false;

  const inRange = located.filter((feature) => isLikelyLatLng(feature)).length;
  return inRange * 2 > located.length;
};

const textOf = async (file: SourceFile): Promise<string> =>
  file.text
    ? file.text()
    : new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()));
