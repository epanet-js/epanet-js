import type { IFeatureCollection, GeoJSON, Geometry } from "src/types";
import { z } from "zod";
import { hexToArray } from "src/lib/color";
type GeoJSONTypeList = GeoJSON["type"][];
type GeometryTypeList = Geometry["type"][];

/**
 * Just the washington post visual forensics team.
 * They asked for pausable memberships and I implemented them.
 * Maybe a mistake?
 */
export const PAUSABLE_ORGS = new Set([600]);

/**
 * Size of a row in the left panel
 */
export const LEFT_PANEL_ROW_HEIGHT = 24;

/**
 * Layer names
 */

export const DECK_SYNTHETIC_ID = "deckgl-synthetic";

/**
 * Colors
 */

export const colors = {
  cyan900: "#083344",
  cyan800: "#0e7490",
  cyan700: "#06b6d4",
  cyan600: "#22d3ee",
  cyan500: "#06b6d4",
  cyan400: "#67e8f9",
  cyan300: "#a5f3fc",
  cyan200: "#cffafe",
  cyan100: "#e0f8fa",
  cyan50: "#ecfeff",
  purple900: "#581c87",
  purple800: "#6b21a8",
  purple700: "#7e22ce",
  purple600: "#9333ea",
  purple500: "#a855f7",
  purple400: "#c084fc",
  purple300: "#d8b4fe",
  purple200: "#e9d5ff",
  purple100: "#f3e8ff",
  purple50: "#faf5ff",
  indigo900: "#312E81",
  indigo800: "#3730a3",
  indigo50: "#eef2ff",
  indigo100: "#e0e7ff",
  indigo200: "#c7d2fe",
  indigo300: "#a5b4fc",
  indigo400: "#818cf8",
  indigo500: "#6366f1",
  indigo600: "#4f46e5",
  fuchsia500: "#d946ef",
  fuchsia400: "#e879f9",
  fuchsia300: "#f0abfc",
  amber800: "#6C5B37",
  orange800: "#705A31",
  yellow600: "#C6C95C",
  yellow800: "#7A6F35",
  yellow700: "#9A9238",
  orange700: "#c2410c",
  red100: "#fee2e2",
  red300: "#fca5a5",
  red700: "#b91c1c",
  green100: "#dcfce7",
  green300: "#86efac",
  green800: "#166534",
  gray100: "#f3f4f6",
  gray300: "#d1d5db",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
};

export const LINE_COLORS_IDLE = "#8B5CF6";
export const LINE_COLORS_IDLE_RGBA = hexToArray("#8B5CF6");

export const POINT_COLORS_SELECTED = colors.fuchsia500;
export const LINE_COLORS_SELECTED = colors.fuchsia500;
export const LINE_COLORS_SELECTED_RGB = hexToArray("#D6409F");

// Note, this is also in the database schema.
// If changing it here, it may need to be changed there too.
export const UNTITLED = "Untitled";

/**
 * Utilities ------------------------------------------------------------------
 */
export const targetSize = [160, 160] as const;

/**
 * Errors that we can represent by redirecting to a page
 * with the error code.
 *
 * This is to avoid the possibility of an ?error=Message…
 * query, which could be a reflection attack.
 */
export const ERROR_CODES = {
  SSO_ORGANIZATION_NO_ID:
    "This organization is set up with SSO but does not have an active SSO provider.",
  SSO_ORGANIZATION_MISSING:
    "This organization is set up with SSO but not connected in Placemark.",
  GITHUB_TOKEN_MISSING:
    "You were redirected back to Placemark after authenticating with GitHub, but the token was missing.",
} as const;

export function errorUrl(code: keyof typeof ERROR_CODES) {
  return `/error?code=${code}`;
}

export const SUPPORT_EMAIL = "support@epanetjs.com";

export const emptySelection = new Set<RawId>();
export const CURSOR_DEFAULT = "";
export const CURSOR_CROSSHAIR = "crosshair";

export const MAX_GEOCODER_ROWS = 100;

export const PLACEMARK_ID_PROP = "@id";
export const PLACEMARK_FOLDER_PROP = "@folder";
const lengthFactors = {
  // Metric
  millimeters: 1000,
  centimeters: 100,
  meters: 1,
  kilometers: 1 / 1000,

  feet: 3.28084,
  inches: 39.37,
  miles: 1 / 1609.344,
  nauticalmiles: 1 / 1852,

  // Other
  degrees: 1 / 111325,
  radians: 1,
  yards: 1.0936133,
} as const;

const areaFactors = {
  // metric
  millimeters: 1000000,
  centimeters: 10000,
  meters: 1,
  hectares: 0.0001,
  kilometers: 0.000001,

  // imperial
  inches: 1550.003100006,
  feet: 10.763910417,
  yards: 1.195990046,
  acres: 0.000247105,
  miles: 3.86e-7,
} as const;

export const GROUPED_UNIT_OPTIONS = {
  length: [
    {
      name: "Metric",
      items: [
        {
          key: "millimeters",
          name: "millimeters",
          value: lengthFactors.millimeters,
        },
        {
          key: "centimeters",
          name: "centimeters",
          value: lengthFactors.centimeters,
        },
        { key: "meters", name: "meters", value: lengthFactors.meters },
        {
          key: "kilometers",
          name: "kilometers",
          value: lengthFactors.kilometers,
        },
      ],
    },
    {
      name: "Imperial",
      items: [
        { key: "feet", name: "feet", value: lengthFactors.feet },
        { key: "inches", name: "inches", value: lengthFactors.inches },
        { key: "miles", name: "miles", value: lengthFactors.miles },
      ],
    },
    {
      name: "Other",
      items: [
        {
          key: "nauticalmiles",
          name: "nautical miles",
          value: lengthFactors.nauticalmiles,
        },
        { key: "degrees", name: "degrees", value: lengthFactors.degrees },
        { key: "radians", name: "radians", value: lengthFactors.radians },
      ],
    },
  ],
  area: [
    {
      name: "Metric",
      items: [
        {
          key: "millimeters",
          name: "millimeters",
          value: areaFactors.millimeters,
        },
        {
          key: "centimeters",
          name: "centimeters",
          value: areaFactors.centimeters,
        },
        { key: "meters", name: "meters", value: areaFactors.meters },
        { key: "hectares", name: "hectares", value: areaFactors.hectares },
        {
          key: "kilometers",
          name: "kilometers",
          value: areaFactors.kilometers,
        },
      ],
    },
    {
      name: "Imperial",
      items: [
        { key: "feet", name: "feet", value: areaFactors.feet },
        { key: "inches", name: "inches", value: areaFactors.inches },
        { key: "yards", name: "yards", value: areaFactors.yards },
        { key: "acres", name: "acres", value: areaFactors.acres },
        { key: "miles", name: "miles", value: areaFactors.miles },
      ],
    },
  ],
};

export const SCHEMA_VERSION = "1";

export const MB_TO_BYTES = 1_000_000;

export const geometryTypes: GeometryTypeList = [
  "Point",
  "MultiPoint",
  "Polygon",
  "MultiPolygon",
  "LineString",
  "MultiLineString",
  "GeometryCollection",
];

export const SIMPLESTYLE_PROPERTIES = [
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "fill",
  "fill-opacity",
] as const;

export const geojsonTypes: GeoJSONTypeList = [
  "FeatureCollection",
  "Feature",
  "Point",
  "MultiPoint",
  "Polygon",
  "MultiPolygon",
  "LineString",
  "MultiLineString",
  "GeometryCollection",
];

export const EMPTY_ARRAY: any[] = [];

const multiGeometryTypes: GeoJSONTypeList = [
  "MultiPoint",
  "MultiPolygon",
  "MultiLineString",
  "GeometryCollection",
];

type GeometryMap = Record<Geometry["type"], Geometry["type"] | null>;

export const MULTI_TO_SINGULAR: GeometryMap = {
  MultiPoint: "Point",
  MultiPolygon: "Polygon",
  MultiLineString: "LineString",
  Point: null,
  Polygon: null,
  LineString: null,
  GeometryCollection: null,
};

export const COORDINATE_ORDERS = {
  LONLAT: "Longitude, latitude",
  LATLON: "Latitude, longitude",
};

export const GEOJSON_TYPES: Set<string> = new Set(geojsonTypes);

export const GEOJSON_MULTI_GEOMETRY_TYPES: Set<string> = new Set(
  multiGeometryTypes,
);

export const DEFAULT_QUERY_OPTIONS = {
  refetchOnWindowFocus: false,
};

export const IMAGE_SYM: unique symbol = Symbol("image");

export const NONE_VAL = "@@NONE@@";

export const emptyFeatureCollection: IFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export const FILE_WARN_MB = Infinity;
export const FILE_WARN_BYTES = FILE_WARN_MB * MB_TO_BYTES;

export const FILE_LIMIT_MB = Infinity;
export const FILE_LIMIT_BYTES = FILE_LIMIT_MB * MB_TO_BYTES;

export const SCALE_UNITS = ["imperial", "metric", "nautical"] as const;
export type ScaleUnit = (typeof SCALE_UNITS)[number];
export const zScaleUnit = z.enum(SCALE_UNITS);

export const WHITE: RGBA = [255, 255, 255, 255];

export const LINE_COLORS = {
  idle: "#8B5CF6",
  selected: "#D6409F",
} as const;

export const LINE_IDLE = hexToArray(LINE_COLORS.idle);
export const LINE_SELECTED = hexToArray(LINE_COLORS.selected);
