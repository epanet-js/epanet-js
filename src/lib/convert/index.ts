import { FeatureCollection, FeatureMap, FolderMap } from "src/types";
import { ConvertResult, getExtension } from "./utils";

import { CSV } from "./csv";
import { OSM } from "./osm";
import { XLS } from "./xls";
import { GeoJSON } from "./geojson";
import { GEOJSON_TYPES } from "src/lib/constants";
import { ConvertError, parseOrError, PlacemarkError } from "src/lib/errors";
import { EitherAsync } from "purify-ts/EitherAsync";
import { Left } from "purify-ts/Either";
import { CoordinateString } from "./coordinate-string";
import isPlainObject from "lodash/isPlainObject";
import { JsonObject, JsonValue } from "type-fest";
import { ProxyMarked } from "comlink";
import { Inp } from "./inp";

export enum GeocodingBehavior {
  NULL_GEOMETRY,
  DISCARD,
}

export interface ExportedData {
  extensions: FileType["extensions"];
  result: {
    blob: Blob;
    name: string;
  };
}

export const CSV_DELIMITERS = [
  { value: ",", label: "," },
  { value: ";", label: ";" },
  { value: "\t", label: "Tab" },
] as const;

export const CSV_KINDS = [
  {
    value: "lonlat",
    label: "Coordinates",
  },
  { value: "zip", label: "ZIP Codes" },
  { value: "geojson", label: "GeoJSON Column" },
  { value: "join", label: "Join to geodata" },
  { value: "addresses", label: "Addresses" },
] as const;

export const DEFAULT_IMPORT_OPTIONS: Omit<ImportOptions, "type"> = {
  coordinateStringOptions: {
    order: "LONLAT",
  },
  removeCoincidents: true,
  csvOptions: {
    sheet: "",
    longitudeHeader: "",
    latitudeHeader: "",
    joinSourceHeader: "",
    joinTargetHeader: "",
    geometryHeader: "",
    zipHeader: "",
    kind: "lonlat",
    autoType: true,
    delimiter: ",",
    geocodingType: "search",
    geocodingBehavior: GeocodingBehavior.NULL_GEOMETRY,
    // https://geocode.earth/docs/forward/structured/
    geocodingHeaders: {
      text: "",
      address: "",
      neighbourhood: "",
      borough: "",
      locality: "",
      county: "",
      region: "",
      postalcode: "",
      country: "",
    },
  },
} as const;

/**
 * Import options with object type.
 */
export interface ImportOptions {
  type: FileType["id"];
  toast?: boolean;
  coordinateStringOptions: {
    order: "LONLAT" | "LATLON";
  };
  removeCoincidents?: boolean;
  csvOptions: {
    // For XLSX, technically. Shoving it in here.
    sheet: string;
    // Would be nice to keep that consistent.
    longitudeHeader: string | null;
    latitudeHeader: string | null;
    /** For WKT / GeoJSON kind */
    geometryHeader: string | null;
    zipHeader: string | null;
    kind: (typeof CSV_KINDS)[number]["value"];
    delimiter: (typeof CSV_DELIMITERS)[number]["value"];
    autoType: boolean;
    geocodingType: "search" | "structured";
    geocodingBehavior: GeocodingBehavior;
    joinSourceHeader: string;
    joinTargetHeader: string;
    geocodingHeaders: {
      address: string;
      neighbourhood: string;
      borough: string;
      locality: string;
      county: string;
      region: string;
      postalcode: string;
      country: string;
      text: string;
    };
  };
}

export const COORDINATE_STRING_ORDERS: Array<{
  value: ImportOptions["coordinateStringOptions"]["order"];
  label: string;
}> = [
  {
    value: "LONLAT",
    label: "Longitude, Latitude",
  },
  {
    value: "LATLON",
    label: "Latitude, longitude",
  },
];

export type Winding = "RFC7946" | "d3";

export interface ExportOptions {
  type: FileType["id"];
  folderId: string | null;
  geojsonOptions?: {
    winding: Winding;
    truncate: boolean;
    addBboxes: boolean;
    indent: boolean;
    includeId: boolean;
  };
  csvOptions?: ImportOptions["csvOptions"];
}

export const DEFAULT_EXPORT_GEOJSON_OPTIONS: ExportOptions["geojsonOptions"] = {
  winding: "RFC7946",
  truncate: true,
  addBboxes: false,
  indent: false,
  includeId: false,
};

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  geojsonOptions: DEFAULT_EXPORT_GEOJSON_OPTIONS,
  folderId: null,
  type: "geojson",
};

export interface ExportResult {
  blob: Blob;
  name: string;
}

export interface Progress {
  total: number;
  done: number;
}

export type RawProgressCb = (progress: Progress) => void;
export type ProgressCb = RawProgressCb & ProxyMarked;

export interface FileType {
  readonly id: "geojson" | "inp" | "csv" | "coordinate-string" | "xls" | "osm";
  readonly label: string | string[];
  readonly extensions: string[];
  readonly mimes: string[];
  readonly filenames: string[];
  forwardBinary?: (
    file: ArrayBuffer,
    options: ImportOptions,
    callback: ProgressCb,
  ) => EitherAsync<Error | PlacemarkError, ConvertResult>;
  forwardString?: (
    file: string,
    options: ImportOptions,
    callback: ProgressCb,
  ) => EitherAsync<Error | PlacemarkError, ConvertResult>;
  back?: (
    inputs: {
      geojson: FeatureCollection;
      featureMapDeprecated: FeatureMap;
      folderMap: FolderMap;
    },
    options: ExportOptions,
  ) => EitherAsync<PlacemarkError, ExportResult>;
}

export const FILE_TYPES = [
  GeoJSON,
  Inp,
  CSV,
  XLS,
  CoordinateString,
  OSM,
] as const;

function assertIsObject(obj: JsonValue): obj is JsonObject {
  return isPlainObject(obj);
}

async function detectJson(file: File) {
  // performance here is rough:
  // we're parsing the full json object.
  const res = await EitherAsync<PlacemarkError, ImportOptions>(
    async function detectJsonInner({ liftEither, throwE }) {
      const text = await file.text();
      const obj = await liftEither(parseOrError(text));
      if (!assertIsObject(obj)) {
        return throwE(new PlacemarkError("Could not determine JSON type"));
      }
      if (typeof obj.type === "string" && GEOJSON_TYPES.has(obj.type)) {
        return { ...DEFAULT_IMPORT_OPTIONS, type: GeoJSON.id };
      }
      return throwE(new PlacemarkError("Could not determine JSON type"));
    },
  ).run();

  return res;
}

export function findType(typeStr: string) {
  const type = FILE_TYPES.find((fileType) => fileType.id === typeStr);
  if (!type) throw new Error("Type not found");
  return type;
}

export async function detectType(file: File) {
  return await EitherAsync<PlacemarkError, ImportOptions>(
    async ({ throwE, fromPromise }) => {
      const { name } = file;
      const ext = getExtension(name);

      if (ext === ".json") {
        return await fromPromise(detectJson(file));
      }

      for (const type of FILE_TYPES) {
        if (
          (ext && type.extensions.includes(ext)) ||
          type.mimes.includes(file.type) ||
          (type.filenames && type.filenames.includes(name))
        ) {
          return {
            ...DEFAULT_IMPORT_OPTIONS,
            type: type.id,
          };
        }
      }

      return throwE(new PlacemarkError("Could not detect file type"));
    },
  ).run();
}

export async function stringToGeoJSON(
  ...args: Parameters<NonNullable<FileType["forwardString"]>>
) {
  const driver = findType(args[1].type);
  if ("forwardString" in driver) {
    return await driver.forwardString(...args).run();
  }
  return Left(new ConvertError("Unsupported driver"));
}

export async function fileToGeoJSON(
  ...args: Parameters<NonNullable<FileType["forwardBinary"]>>
) {
  const driver = findType(args[1].type);
  return await driver.forwardBinary(...args).run();
}

export function importToExportOptions(
  options: ImportOptions,
): ExportOptions | null {
  const driver = findType(options.type);
  if (!("back" in driver)) return null;

  return {
    type: options.type,
    folderId: null,
  };
}
