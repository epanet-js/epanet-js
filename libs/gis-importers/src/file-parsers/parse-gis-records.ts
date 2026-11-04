import type { Feature } from "geojson";
import {
  createProjectionTransformer,
  findProjectionByCode,
  type Proj4Projection,
} from "@epanet-js/projections";
import {
  IssueCollector,
  type Issue,
  type SourceFile,
} from "@epanet-js/converters";
import type {
  CoordinateAttributes,
  GisInput,
  RecordsContents,
} from "../importer";
import { GisRecords } from "../records/gis-records";
import { RecordsBuilder, type Transform } from "../records/records-builder";
import { recordsContentsOf } from "./contents";
import { gisFormatOf, isGisSecondaryPart } from "./formats";
import {
  WGS84_EPSG,
  decodeFeatures,
  failure,
  hasExtension,
  looksLikeDxf,
  projectionOfWkt,
  statedCrs,
  suppliedEpsg,
  textOf,
  type DecodedSource,
} from "./parse-gis-source";
import { readShapefile } from "./read-shapefile";
import { streamFeatureCollection, streamFeatureLines } from "./stream-geojson";

export type ParsedGisRecords = {
  records: GisRecords;
  sourceProjection?: Proj4Projection;
  issues: IssueCollector;
  contents: RecordsContents;
};

type DecodedRecords = {
  records: GisRecords;
  sourceProjection?: Proj4Projection;
  issues: Issue[];
  statedOrder?: string[];
  contents?: RecordsContents;
};

type CacheEntry = {
  files: SourceFile[];
  suppliedEpsg: number | null;
  suppliedAttributes: string | null;
  decoded: DecodedRecords;
};
const cache = new WeakMap<SourceFile, CacheEntry>();

const suppliedAttributes = (
  attributes?: CoordinateAttributes,
): string | null =>
  attributes === undefined ? null : `${attributes.x}\u0000${attributes.y}`;

const sameInput = (
  entry: CacheEntry,
  files: SourceFile[],
  epsg: number | null,
  attributes: string | null,
): boolean =>
  !isDetached(entry.decoded.records) &&
  entry.suppliedEpsg === epsg &&
  entry.suppliedAttributes === attributes &&
  entry.files.length === files.length &&
  entry.files.every((file, index) => file === files[index]);

/** A caller that transferred the buffer to another thread has taken it. */
const isDetached = (records: GisRecords): boolean =>
  records.data.bytes.byteLength === 0;

export const parseGisRecords = async (
  input: GisInput,
): Promise<ParsedGisRecords> => {
  const { files } = input;
  const key = files[0];
  if (key === undefined) return resultOf(empty("sourceEmpty"));

  const epsg = suppliedEpsg(input.crs);
  const attributes = suppliedAttributes(input.coordinateAttributes);
  const cached = cache.get(key);
  if (cached && sameInput(cached, files, epsg, attributes)) {
    return resultOf(cached.decoded);
  }

  const decoded = await decode(input);
  cache.set(key, {
    files,
    suppliedEpsg: epsg,
    suppliedAttributes: attributes,
    decoded,
  });
  return resultOf(decoded);
};

const resultOf = (decoded: DecodedRecords): ParsedGisRecords => {
  const issues = new IssueCollector();
  for (const issue of decoded.issues) issues.add(issue);

  return {
    records: decoded.records,
    ...(decoded.sourceProjection === undefined
      ? {}
      : { sourceProjection: decoded.sourceProjection }),
    issues,
    get contents() {
      return (decoded.contents ??= recordsContentsOf(
        decoded.records,
        decoded.statedOrder,
      ));
    },
  };
};

const empty = (
  code: Parameters<typeof failure>[0],
  skipped: Issue[] = [],
): DecodedRecords => ({
  records: GisRecords.fromData({
    bytes: new RecordsBuilder().encode(),
    indices: null,
  }),
  issues: [...failure(code).issues, ...skipped],
});

const DXF_PROBE_BYTES = 4096;

const decode = async (input: GisInput): Promise<DecodedRecords> => {
  const { files } = input;

  const shpFile = files.find(
    (file) => gisFormatOf(file.name)?.id === "shapefile",
  );
  if (shpFile) return decodeShapefile(files, shpFile, input);

  const primary = files.find((file) => !isGisSecondaryPart(file.name));
  if (primary === undefined) return empty("sourceFilesIncomplete");

  const format = gisFormatOf(primary.name)?.id;
  if (format === "dxf" || format === "csv") {
    return fromFeatures(await decodeFeatures(input));
  }

  const bytes = new Uint8Array(await primary.arrayBuffer());
  const probe = new TextDecoder().decode(bytes.subarray(0, DXF_PROBE_BYTES));
  if (looksLikeDxf(probe)) return fromFeatures(await decodeFeatures(input));

  return decodeGeoJson(bytes, input);
};

const fromFeatures = (decoded: DecodedSource): DecodedRecords => {
  const builder = new RecordsBuilder();
  for (const feature of decoded.features) builder.addFeature(feature);

  return {
    records: GisRecords.fromData({ bytes: builder.encode(), indices: null }),
    ...(decoded.sourceProjection === undefined
      ? {}
      : { sourceProjection: decoded.sourceProjection }),
    issues: decoded.issues,
    ...(decoded.statedOrder === undefined
      ? {}
      : { statedOrder: decoded.statedOrder }),
  };
};

type Collected = {
  builder: RecordsBuilder;
  skipped: Issue[];
  add: (feature: Feature) => void;
};

const collector = (): Collected => {
  const builder = new RecordsBuilder();
  const skipped: Issue[] = [];
  let ref = 0;

  return {
    builder,
    skipped,
    add: (feature) => {
      const parts = builder.addFeature(feature);
      if (parts > 0) {
        ref += parts;
        return;
      }

      skipped.push({
        code: "featureCoordinatesInvalid",
        severity: "warning",
        ref: String(ref),
        raw: feature,
      });
      ref += 1;
    },
  };
};

type Placed = { sourceProjection?: Proj4Projection; issues: Issue[] };

const finished = (
  { builder, skipped }: Collected,
  placed: Placed,
): DecodedRecords => ({
  records: GisRecords.fromData({ bytes: builder.encode(), indices: null }),
  ...(placed.sourceProjection === undefined
    ? {}
    : { sourceProjection: placed.sourceProjection }),
  issues: [...placed.issues, ...skipped],
});

const decodeGeoJson = (
  bytes: Uint8Array,
  { crs, projections }: GisInput,
): DecodedRecords => {
  let collected = collector();
  const collection = streamFeatureCollection(bytes, collected.add);
  let stated: number | null = null;

  if (collection === null) {
    collected = collector();
    if (streamFeatureLines(bytes, collected.add) === 0) {
      return empty("sourceUnreadable");
    }
  } else {
    stated = statedCrs({ crs: collection.crs });
  }

  if (!collected.builder.hasGeometry()) {
    return empty("sourceEmpty", collected.skipped);
  }

  const epsg = suppliedEpsg(crs) ?? stated;
  return finished(collected, placeIn(collected.builder, epsg, projections));
};

const placeIn = (
  builder: RecordsBuilder,
  epsg: number | null,
  projections: Map<string, Proj4Projection> | undefined,
): Placed => {
  if (epsg === null) {
    return builder.mostlyLatLng()
      ? { issues: [{ code: "coordinateSystemMissing", severity: "warning" }] }
      : { issues: [{ code: "coordinateSystemUnknown", severity: "error" }] };
  }

  if (epsg === WGS84_EPSG) {
    return builder.mostlyLatLng()
      ? { issues: [] }
      : { issues: [{ code: "coordinateSystemMismatch", severity: "error" }] };
  }

  const projection = findProjectionByCode(
    String(epsg),
    projections ?? new Map<string, Proj4Projection>(),
  );
  if (projection === null) {
    return {
      issues: [{ code: "coordinateSystemUnsupported", severity: "error" }],
    };
  }

  const moved = builder.transformed(transformerOf(projection.code));
  if (moved === null || !builder.mostlyLatLng(moved)) {
    return {
      issues: [{ code: "coordinateSystemMismatch", severity: "error" }],
    };
  }

  builder.useCoordinates(moved, { keepZ: false });
  return { sourceProjection: projection, issues: [] };
};

const failingTransform: Transform = () => {
  throw new Error("No transform");
};

const transformerOf = (code: string): Transform => {
  try {
    return createProjectionTransformer(code);
  } catch {
    return failingTransform;
  }
};

const decodeShapefile = async (
  files: SourceFile[],
  shpFile: SourceFile,
  { crs, projections }: GisInput,
): Promise<DecodedRecords> => {
  const byExtension = (extension: string) =>
    files.find((file) => hasExtension(file, extension));

  const dbf = byExtension(".dbf");
  const prjFile = byExtension(".prj");
  const cpg = byExtension(".cpg");
  const supplied = suppliedEpsg(crs);
  const prj = prjFile && supplied === null ? await textOf(prjFile) : undefined;

  const collected = collector();
  const read = readShapefile(
    {
      shp: await shpFile.arrayBuffer(),
      ...(dbf ? { dbf: await dbf.arrayBuffer() } : {}),
      ...(cpg ? { cpg: await textOf(cpg) } : {}),
    },
    collected.add,
  );
  if (!read) return empty("sourceUnreadable");

  const { builder } = collected;
  if (!builder.hasGeometry()) return empty("sourceEmpty", collected.skipped);

  if (prj === undefined) {
    return finished(collected, placeIn(builder, supplied, projections));
  }

  const transform = prjTransformOf(prj);
  const moved = transform && builder.transformed(transform);
  if (transform && moved === null) return empty("sourceUnreadable");

  if (builder.mostlyLatLng(moved ?? undefined)) {
    if (moved) builder.useCoordinates(moved, { keepZ: true });
    const sourceProjection = projectionOfWkt(prj, projections);
    return finished(collected, {
      ...(sourceProjection === null ? {} : { sourceProjection }),
      issues: [],
    });
  }

  const unchanged = moved === null || builder.sameFirstPosition(moved);
  return finished(collected, {
    issues: [
      {
        code: unchanged
          ? "coordinateSystemUnsupported"
          : "coordinateSystemMismatch",
        severity: "error",
      },
    ],
  });
};

const prjTransformOf = (prj: string): Transform | null => {
  try {
    return createProjectionTransformer(prj);
  } catch {
    return null;
  }
};
