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

type CacheEntry = { files: SourceFile[]; decoded: DecodedSource };
const cache = new WeakMap<SourceFile, CacheEntry>();

const sameFiles = (entry: CacheEntry, files: SourceFile[]): boolean =>
  entry.files.length === files.length &&
  entry.files.every((file, index) => file === files[index]);

export const parseGisSource = async (
  input: GisInput,
): Promise<ParsedGisSource> => {
  const { files } = input;
  const key = files[0];
  if (key === undefined) return resultOf(failure("sourceEmpty"));

  const cached = cache.get(key);
  if (cached && sameFiles(cached, files)) return resultOf(cached.decoded);

  const decoded = await decode(input);
  cache.set(key, { files, decoded });
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
    | "coordinateSystemUnknown"
    | "coordinateSystemUnsupported"
    | "coordinateSystemMismatch",
): DecodedSource => ({
  features: [],
  issues: [{ code, severity: "error" }],
});

const decode = async (input: GisInput): Promise<DecodedSource> => {
  const { files } = input;
  const shpFile = files.find((file) =>
    file.name.toLowerCase().endsWith(".shp"),
  );

  return shpFile
    ? parseShapefile(files, shpFile)
    : parseGeoJson(files[0], input);
};

const parseShapefile = async (
  files: SourceFile[],
  shpFile: SourceFile,
): Promise<DecodedSource> => {
  const byExtension = (extension: string) =>
    files.find((file) => file.name.toLowerCase().endsWith(extension));

  const dbf = byExtension(".dbf");
  const prj = byExtension(".prj");
  const cpg = byExtension(".cpg");

  if (!dbf || !prj) return failure("sourceFilesIncomplete");

  const input: {
    shp: ArrayBuffer;
    dbf: ArrayBuffer;
    prj: string;
    cpg?: string;
  } = {
    shp: await shpFile.arrayBuffer(),
    dbf: await dbf.arrayBuffer(),
    prj: await textOf(prj),
  };
  if (cpg) input.cpg = await textOf(cpg);

  let collection: FeatureCollection;
  try {
    collection = await shp(input);
  } catch {
    return failure("sourceUnreadable");
  }

  const features = collection.features ?? [];
  if (features.length === 0) return failure("sourceEmpty");

  if (!mostlyLatLng(features)) return failure("sourceUnreadable");

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

  const statedCrs = parsed.stated ?? (crs?.type === "epsg" ? crs.code : null);

  if (statedCrs === null || statedCrs === WGS84_EPSG) {
    if (!mostlyLatLng(parsed.features))
      return failure(
        statedCrs === null
          ? "coordinateSystemUnknown"
          : "coordinateSystemMismatch",
      );

    return {
      features: parsed.features,
      issues:
        statedCrs === null
          ? [{ code: "coordinateSystemMissing", severity: "warning" }]
          : [],
    };
  }

  const projection = findProjectionByCode(
    String(statedCrs),
    projections ?? new Map<string, Proj4Projection>(),
  );
  if (projection === null) return failure("coordinateSystemUnsupported");

  let converted: FeatureCollection;
  try {
    converted = convertGeoJsonToWGS84(
      { type: "FeatureCollection", features: parsed.features },
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
  new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()));
