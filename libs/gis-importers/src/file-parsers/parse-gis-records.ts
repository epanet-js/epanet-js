import type { Feature, Geometry, Position } from "geojson";
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
import type { GisInput, RecordsContents } from "../importer";
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
  parseDxf,
  coordinateWarnings,
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

export const parseGisRecords = async (
  input: GisInput,
): Promise<ParsedGisRecords> =>
  resultOf(
    input.files.length === 0 ? empty("sourceEmpty") : await decode(input),
  );

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

  const buffer = await primary.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const probe = new TextDecoder().decode(bytes.subarray(0, DXF_PROBE_BYTES));
  if (looksLikeDxf(probe)) return fromFeatures(await parseDxf(buffer, input));

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

type Unprojectable = { record: number; written: Position[] };

type Placed = {
  sourceProjection?: Proj4Projection;
  issues: Issue[];
  unprojectable?: Unprojectable[];
};

/** The records `moved` takes off the globe, with their positions as the file
 *  wrote them; read before the builder takes up `moved`. */
const unprojectableOf = (
  builder: RecordsBuilder,
  moved: Float64Array,
): Unprojectable[] =>
  builder
    .recordsWithInvalidPositions(moved)
    .map((record) => ({ record, written: builder.positionsOf(record) }));

const finished = (
  { builder, skipped }: Collected,
  placed: Placed,
): DecodedRecords => {
  const bytes = builder.encode();
  const all = GisRecords.fromData({ bytes, indices: null });
  const unprojectable = placed.unprojectable ?? [];
  const invalid = unprojectable.map(({ record }) => record);

  return {
    records:
      invalid.length === 0
        ? all
        : GisRecords.fromData({ bytes, indices: keptOf(all.count, invalid) }),
    ...(placed.sourceProjection === undefined
      ? {}
      : { sourceProjection: placed.sourceProjection }),
    issues: [
      ...placed.issues,
      ...coordinateWarnings(
        skipped,
        unprojectable.map(({ record, written }) => ({
          index: record,
          raw: asWritten(all.toFeature(record), written),
        })),
      ),
    ],
  };
};

/** `feature` with its positions put back the way the file wrote them. */
const asWritten = (feature: Feature, written: Position[]): Feature => {
  const geometry = feature.geometry;
  if (geometry === null || geometry.type === "GeometryCollection") {
    return feature;
  }
  let next = 0;
  const restored = (coordinates: unknown): unknown =>
    typeof (coordinates as unknown[])[0] === "number"
      ? written[next++]
      : (coordinates as unknown[]).map(restored);
  return {
    ...feature,
    geometry: {
      ...geometry,
      coordinates: restored(geometry.coordinates),
    } as Geometry,
  };
};

const keptOf = (count: number, dropped: number[]): Uint32Array => {
  const kept = new Uint32Array(count - dropped.length);
  let next = 0;
  let skip = 0;
  for (let record = 0; record < count; record++) {
    if (dropped[skip] === record) skip += 1;
    else kept[next++] = record;
  }
  return kept;
};

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

  const unprojectable = unprojectableOf(builder, moved);
  builder.useCoordinates(moved, { keepZ: false });
  return { sourceProjection: projection, issues: [], unprojectable };
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
  if (transform && moved === null) {
    return empty("sourceUnreadable", collected.skipped);
  }

  if (builder.mostlyLatLng(moved ?? undefined)) {
    const unprojectable = moved ? unprojectableOf(builder, moved) : [];
    if (moved) builder.useCoordinates(moved, { keepZ: true });
    const sourceProjection = projectionOfWkt(prj, projections);
    return finished(collected, {
      ...(sourceProjection === null ? {} : { sourceProjection }),
      issues: [],
      unprojectable,
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
