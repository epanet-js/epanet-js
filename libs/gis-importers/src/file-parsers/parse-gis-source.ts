import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
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
import type { GisInput, SourceContents } from "../importer";
import { contentsOf } from "./contents";
import { gisFormatOf, isGisSecondaryPart } from "./formats";
import { readDxf, type DxfBounds, type DxfStatedCrs } from "./parse-dxf";

export type ParsedGisSource = {
  features: Feature[];
  sourceProjection?: Proj4Projection;
  issues: IssueCollector;
  contents: SourceContents;
};

type DecodedSource = {
  features: Feature[];
  sourceProjection?: Proj4Projection;
  issues: Issue[];
  contents?: SourceContents;
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

  const decoded = asSingleParts(await decode(input));
  cache.set(key, { files, suppliedEpsg: epsg, decoded });
  return resultOf(decoded);
};

const POSITION_NUMBERS = 2;
const LINE_POSITIONS = 2;

const asSingleParts = (decoded: DecodedSource): DecodedSource => {
  const features: Feature[] = [];
  const skipped: Issue[] = [];
  let ref = 0;

  for (const feature of decoded.features) {
    const parts = singlePartsOf(feature);

    if (parts.length === 0) {
      skipped.push({
        code: "featureCoordinatesInvalid",
        severity: "warning",
        ref: String(ref),
        raw: feature,
      });
      ref += 1;
      continue;
    }

    features.push(...parts);
    ref += parts.length;
  }

  if (skipped.length === 0) return { ...decoded, features };

  return { ...decoded, features, issues: [...decoded.issues, ...skipped] };
};

const singlePartsOf = (feature: Feature): Feature[] => {
  const geometry = feature.geometry;

  if (geometry?.type === "MultiPoint") {
    return geometry.coordinates.filter(isPosition).map((coordinates) => ({
      ...feature,
      geometry: { type: "Point" as const, coordinates },
    }));
  }

  if (geometry?.type === "MultiLineString") {
    return geometry.coordinates.filter(isLine).map((coordinates) => ({
      ...feature,
      geometry: { type: "LineString" as const, coordinates },
    }));
  }

  if (geometry?.type === "Point") {
    return isPosition(geometry.coordinates) ? [feature] : [];
  }

  if (geometry?.type === "LineString") {
    return isLine(geometry.coordinates) ? [feature] : [];
  }

  if (geometry?.type === "Polygon") {
    return geometry.coordinates.every(isRing) ? [feature] : [];
  }

  if (geometry?.type === "MultiPolygon") {
    return geometry.coordinates.every((rings) => rings.every(isRing))
      ? [feature]
      : [];
  }

  return [feature];
};

const isPosition = (position: Position): boolean =>
  Array.isArray(position) &&
  position.length >= POSITION_NUMBERS &&
  Number.isFinite(position[0]) &&
  Number.isFinite(position[1]);

const isLine = (positions: Position[]): boolean =>
  Array.isArray(positions) &&
  positions.length >= LINE_POSITIONS &&
  positions.every(isPosition);

const isRing = (ring: Position[]): boolean =>
  Array.isArray(ring) && ring.every(isPosition);

const resultOf = (decoded: DecodedSource): ParsedGisSource => {
  const issues = new IssueCollector();
  for (const issue of decoded.issues) issues.add(issue);

  return {
    features: decoded.features,
    ...(decoded.sourceProjection === undefined
      ? {}
      : { sourceProjection: decoded.sourceProjection }),
    issues,
    get contents() {
      return (decoded.contents ??= contentsOf(decoded.features));
    },
  };
};

const failure = (
  code: "sourceEmpty" | "sourceUnreadable" | "sourceFilesIncomplete",
): DecodedSource => ({
  features: [],
  issues: [{ code, severity: "error" }],
});

type PlacementError =
  | "coordinateSystemUnsupported"
  | "coordinateSystemMismatch";

const unplaced = (
  features: Feature[],
  code: PlacementError,
): DecodedSource => ({
  features,
  issues: [{ code, severity: "error" }],
});

const hasExtension = (file: SourceFile, extension: string) =>
  file.name.toLowerCase().endsWith(extension);

const decode = async (input: GisInput): Promise<DecodedSource> => {
  const { files } = input;

  const shpFile = files.find(
    (file) => gisFormatOf(file.name)?.id === "shapefile",
  );
  if (shpFile) return parseShapefile(files, shpFile, input);

  const primary = files.find((file) => !isGisSecondaryPart(file.name));
  if (primary === undefined) return failure("sourceFilesIncomplete");

  if (gisFormatOf(primary.name)?.id === "dxf") {
    return parseDxf(await primary.arrayBuffer(), input);
  }

  const content = await textOf(primary);

  return looksLikeDxf(content)
    ? parseDxf(await primary.arrayBuffer(), input)
    : parseGeoJson(content, input);
};

const DXF_START = /^(?:\s*999[^\n]*\n[^\n]*\n)*\s*0[^\S\n]*\r?\n\s*SECTION/;

const looksLikeDxf = (content: string): boolean => DXF_START.test(content);

const parseDxf = (
  bytes: ArrayBuffer,
  { crs, projections }: GisInput,
): DecodedSource => {
  const parsed = readDxf(bytes);
  if (parsed === null) return failure("sourceUnreadable");
  if (!parsed.features.some(hasGeometry)) return failure("sourceEmpty");

  const supplied = suppliedEpsg(crs);
  if (supplied !== null || parsed.stated === undefined) {
    return placeFeatures({
      features: parsed.features,
      epsg: supplied,
      projections,
    });
  }

  return placeAsDrawingStates(parsed.features, parsed.stated, projections);
};

const placeAsDrawingStates = (
  features: Feature[],
  stated: DxfStatedCrs,
  projections: Map<string, Proj4Projection> | undefined,
): DecodedSource => {
  if (stated.bounds !== undefined && !mostlyInside(features, stated.bounds)) {
    return unplaced(features, "coordinateSystemMismatch");
  }

  if (stated.wkt === undefined) {
    return stated.epsg === undefined
      ? unplaced(features, "coordinateSystemUnsupported")
      : placeFeatures({ features, epsg: stated.epsg, projections });
  }

  const projection = projectionOfWkt(stated.wkt, projections);
  if (projection === null) {
    return placeFeatures({ features, epsg: WGS84_EPSG, projections });
  }

  const attempt = placeWith(features, projection);
  return typeof attempt === "string" ? unplaced(features, attempt) : attempt;
};

const mostlyInside = (
  features: Feature[],
  [minX, minY, maxX, maxY]: DxfBounds,
): boolean => {
  let located = 0;
  let inside = 0;

  for (const feature of features) {
    const position = firstPosition(feature.geometry);
    if (position === null) continue;

    located += 1;
    const [x, y] = position;
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) inside += 1;
  }

  return located === 0 || inside * 2 > located;
};

const firstPosition = (geometry: Geometry | null): Position | null => {
  if (geometry === null || geometry.type === "GeometryCollection") return null;

  let coordinates: unknown = geometry.coordinates;
  while (Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
    coordinates = coordinates[0];
  }

  return Array.isArray(coordinates) && typeof coordinates[0] === "number"
    ? (coordinates as Position)
    : null;
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

  const supplied = suppliedEpsg(crs);

  const input: ShapefileInput = { shp: await shpFile.arrayBuffer() };
  if (dbf) input.dbf = await dbf.arrayBuffer();
  if (prj && supplied === null) input.prj = await textOf(prj);
  if (cpg) input.cpg = await textOf(cpg);

  const features = await decodeBundle(input);
  if (features === null) return failure("sourceUnreadable");
  if (!features.some(hasGeometry)) return failure("sourceEmpty");

  if (input.prj === undefined) {
    return placeFeatures({ features, epsg: supplied, projections });
  }

  if (mostlyLatLng(features)) {
    const sourceProjection = projectionOfWkt(input.prj, projections);

    return {
      features,
      ...(sourceProjection === null ? {} : { sourceProjection }),
      issues: [],
    };
  }

  const withoutPrj = { ...input };
  delete withoutPrj.prj;
  const written = (await decodeBundle(withoutPrj)) ?? features;
  const error = sameFirstGeometry(written, features)
    ? "coordinateSystemUnsupported"
    : "coordinateSystemMismatch";

  return unplaced(written, error);
};

type ShapefileInput = {
  shp: ArrayBuffer;
  dbf?: ArrayBuffer;
  prj?: string;
  cpg?: string;
};

const decodeBundle = async (
  input: ShapefileInput,
): Promise<Feature[] | null> => {
  try {
    const collection: FeatureCollection = await shp(input);
    return collection.features ?? [];
  } catch {
    return null;
  }
};

const sameFirstGeometry = (a: Feature[], b: Feature[]): boolean => {
  const first = (features: Feature[]) =>
    JSON.stringify(features.find((feature) => feature.geometry)?.geometry);
  return first(a) === first(b);
};

const WGS84_WKT_NAMES = new Set(["gcs_wgs_1984", "wgs 84", "wgs84"]);

const projectionOfWkt = (
  wkt: string,
  projections: Map<string, Proj4Projection> | undefined,
): Proj4Projection | null => {
  const text = wkt.trim();
  const name = /^(?:PROJCS|GEOGCS|PROJCRS|GEOGCRS)\["([^"]+)"/i.exec(text)?.[1];
  if (name === undefined || WGS84_WKT_NAMES.has(name.toLowerCase())) {
    return null;
  }

  const epsg = epsgFromWkt(text);
  if (epsg === String(WGS84_EPSG)) return null;

  const listed =
    epsg === undefined
      ? null
      : findProjectionByCode(
          epsg,
          projections ?? new Map<string, Proj4Projection>(),
        );
  if (listed !== null) return listed;

  return { type: "proj4", id: name, name, code: text };
};

const AUTHORITY = /AUTHORITY\s*\[\s*"epsg"\s*,\s*"?(\d+)"?\s*\]/gi;

const epsgFromWkt = (text: string): string | undefined => {
  AUTHORITY.lastIndex = 0;
  let authority: RegExpExecArray | null;
  let epsg: string | undefined;

  while ((authority = AUTHORITY.exec(text)) !== null) {
    if (depthAt(text, authority.index) === 1) epsg = authority[1];
  }

  return epsg;
};

const depthAt = (text: string, index: number): number => {
  let depth = 0;
  let quoted = false;

  for (let at = 0; at < index; at++) {
    const character = text[at];
    if (character === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (character === "[") depth += 1;
    else if (character === "]") depth -= 1;
  }

  return depth;
};

const parseGeoJson = (
  content: string,
  { crs, projections }: GisInput,
): DecodedSource => {
  const parsed = featuresFromText(content);
  if (parsed === null) return failure("sourceUnreadable");
  if (!parsed.features.some(hasGeometry)) return failure("sourceEmpty");

  return placeFeatures({
    features: parsed.features,
    epsg: suppliedEpsg(crs) ?? parsed.stated,
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
  if (epsg === null) return assumeWgs84(features);

  const attempt = placeIn(features, epsg, projections);
  return typeof attempt === "string" ? unplaced(features, attempt) : attempt;
};

const assumeWgs84 = (features: Feature[]): DecodedSource =>
  mostlyLatLng(features)
    ? {
        features,
        issues: [{ code: "coordinateSystemMissing", severity: "warning" }],
      }
    : {
        features,
        issues: [{ code: "coordinateSystemUnknown", severity: "error" }],
      };

const placeIn = (
  features: Feature[],
  epsg: number,
  projections: Map<string, Proj4Projection> | undefined,
): DecodedSource | PlacementError => {
  if (epsg === WGS84_EPSG) {
    return mostlyLatLng(features)
      ? { features, issues: [] }
      : "coordinateSystemMismatch";
  }

  const projection = findProjectionByCode(
    String(epsg),
    projections ?? new Map<string, Proj4Projection>(),
  );
  if (projection === null) return "coordinateSystemUnsupported";

  return placeWith(features, projection);
};

const placeWith = (
  features: Feature[],
  projection: Proj4Projection,
): DecodedSource | PlacementError => {
  let converted: FeatureCollection;
  try {
    converted = convertGeoJsonToWGS84(
      { type: "FeatureCollection", features },
      projection.code,
    );
  } catch {
    return "coordinateSystemMismatch";
  }

  return mostlyLatLng(converted.features)
    ? {
        features: converted.features,
        sourceProjection: projection,
        issues: [],
      }
    : "coordinateSystemMismatch";
};

const WGS84_EPSG = 4326;

type ParsedGeoJson = { features: Feature[]; stated: number | null };

const featuresFromText = (content: string): ParsedGeoJson | null => {
  const trimmed = content.trim();
  const collection = asFeatureCollection(trimmed);

  if (collection !== null) {
    return {
      features: onlyFeatures(collection.features ?? []),
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
      const candidate: unknown = JSON.parse(line);
      if (isFeature(candidate)) features.push(candidate);
    } catch {
      continue;
    }
  }

  return features.length === 0 ? null : { features, stated: null };
};

const onlyFeatures = (candidates: unknown[]): Feature[] => {
  const firstOther = candidates.findIndex((candidate) => !isFeature(candidate));
  if (firstOther === -1) return candidates as Feature[];

  const features = candidates.slice(0, firstOther) as Feature[];
  for (let index = firstOther + 1; index < candidates.length; index++) {
    const candidate = candidates[index];
    if (isFeature(candidate)) features.push(candidate);
  }
  return features;
};

const isFeature = (candidate: unknown): candidate is Feature =>
  (candidate as Feature | null)?.type === "Feature";

const statedCrs = (collection: FeatureCollection): number | null => {
  const { code } = extractEPSGFromGeoJSON(collection);
  return code === null ? null : Number(code);
};

const hasGeometry = (feature: Feature): boolean => !!feature.geometry;

const mostlyLatLng = (features: Feature[]): boolean => {
  const decided = features.length / 2;
  let located = 0;
  let inRange = 0;

  for (const feature of features) {
    if (!feature.geometry) continue;
    located += 1;
    if (isLikelyLatLng(feature)) inRange += 1;
    if (inRange > decided) return true;
    if (located - inRange >= decided) return false;
  }

  return inRange * 2 > located;
};

const textOf = async (file: SourceFile): Promise<string> =>
  file.text
    ? file.text()
    : new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()));
