import { z } from "zod";
import type {
  Feature as IFeature,
  MultiPolygon,
  Point,
  Polygon,
  MultiPoint,
  LineString,
  Geometry,
  FeatureCollection as IFeatureCollection,
} from "geojson";
import type { FlatbushLike } from "src/lib/generate_flatbush_instance";
import type { ModeWithOptions } from "src/state/mode";
import type { Dispatch, SetStateAction } from "react";
import type { IPersistence } from "src/lib/persistence/ipersistence";
import type { Sel } from "src/state/jotai";
import { JsonValue, SetOptional } from "type-fest";
import { IDMap } from "src/lib/id_mapper";
import { getFoldersInTree } from "src/lib/folder";
import { CBColors } from "src/lib/colorbrewer";
import { colors } from "src/lib/constants";
import { safeParseMaybe } from "src/lib/utils";
import { Just, Maybe, Nothing } from "purify-ts/Maybe";
import clamp from "lodash/clamp";
import { HydraulicModel } from "src/hydraulic-model";
import type { MapEngine } from "src/map";

export interface CoordProps {
  x: number;
  y: number;
}

type StrictProperties = { [name: string]: JsonValue } | null;
export type { IFeature, IFeatureCollection };
export type Feature = IFeature<Geometry | null, StrictProperties>;
export type FeatureCollection = IFeatureCollection<Geometry | null>;
export type GeoJSON = Geometry | Feature | FeatureCollection;

export type {
  GeoJSON as IGeoJSON,
  BBox,
  Geometry,
  GeometryCollection,
  GeoJsonProperties,
  Position,
  Point,
  MultiPoint,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from "geojson";

export const zLayerConfigCommon = z.object({
  id: z.string(),
  at: z.string(),
  name: z.string(),
  opacity: z.number().transform((num) => clamp(num, 0, 1)),
  tms: z.optional(z.boolean()).default(false),
  visibility: z.boolean(),
  labelVisibility: z.boolean(),
  sourceMaxZoom: z.record(z.number()),
  isBasemap: z.optional(z.boolean()).default(false),
});

const url = z.string().url();

export const zLayerConfig = z.discriminatedUnion("type", [
  zLayerConfigCommon.extend({
    type: z.literal("XYZ"),
    token: z.string(),
    url,
  }),
  zLayerConfigCommon.extend({
    type: z.literal("MAPBOX"),
    token: z.string().startsWith("pk."),
    url: z.string().startsWith("mapbox://"),
  }),
  zLayerConfigCommon.extend({
    type: z.literal("TILEJSON"),
    token: z.string(),
    url,
  }),
]);

export type ILayerConfig = z.infer<typeof zLayerConfig>;

export interface IWrappedFeature<T = Feature> {
  id: string;
  at: string;
  ephemeral?: boolean;
  folderId: string | null;
  feature: T;
}

export type FeatureMap = Map<string, IWrappedFeature> & { version?: number };
export type FolderMap = Map<string, IFolder> & { version?: number };
export type LayerConfigMap = Map<string, ILayerConfig> & { version?: number };

export type IWrappedFeatureInput = SetOptional<IWrappedFeature, "at">;

export const Presence = z.object({
  bearing: z.number(),
  pitch: z.number(),
  minx: z.number(),
  miny: z.number(),
  maxx: z.number(),
  maxy: z.number(),
  userName: z.string(),
  userId: z.number(),
  updatedAt: z.string(),
  cursorLatitude: z.number(),
  cursorLongitude: z.number(),
  wrappedFeatureCollectionId: z.string().length(21),
  replicacheClientId: z.string(),
});

export type IPresence = z.infer<typeof Presence>;

export type IPresenceMinus = Omit<
  IPresence,
  "replicacheClientId" | "wrappedFeatureCollectionId"
>;

export const Folder = z.object({
  id: z.string(),
  at: z.string(),
  name: z.string(),
  expanded: z.boolean(),
  locked: z.boolean(),
  folderId: z.nullable(z.string()),
  visibility: z.boolean(),
});

export type IFolder = z.infer<typeof Folder>;
export type IFolderInput = SetOptional<IFolder, "at">;

/**
 * Helpers
 */
export const UWrappedFeature = {
  filterMapByFolder(
    featureMapDeprecated: FeatureMap,
    folderMap: FolderMap,
    folderId: string | null,
  ): {
    filteredFeatures: FeatureMap;
    filteredFolders: FolderMap;
  } {
    if (!folderId) {
      return {
        filteredFeatures: featureMapDeprecated,
        filteredFolders: folderMap,
      };
    }

    const filteredFeatures: FeatureMap = new Map();
    const folderIds = getFoldersInTree(folderMap, folderId);
    for (const wrappedFeature of featureMapDeprecated.values()) {
      if (wrappedFeature.folderId && folderIds.has(wrappedFeature.folderId)) {
        filteredFeatures.set(wrappedFeature.id, wrappedFeature);
      }
    }

    const filteredFolders = new Map(
      Array.from(folderMap.entries()).filter(([id]) => {
        return folderIds.has(id);
      }),
    );

    filteredFolders.set(folderId, {
      ...filteredFolders.get(folderId)!,
      folderId: null,
    });

    return {
      filteredFeatures,
      filteredFolders: filteredFolders,
    };
  },
  mapToFeatureCollection(
    featureMapDeprecated: FeatureMap,
    folderMap: FolderMap,
    folderId: string | null,
  ): FeatureCollection {
    const folderIds = folderId && getFoldersInTree(folderMap, folderId);
    const features: FeatureCollection["features"] = [];
    for (const wrappedFeature of featureMapDeprecated.values()) {
      if (
        !folderIds ||
        (wrappedFeature.folderId && folderIds.has(wrappedFeature.folderId))
      ) {
        features.push(wrappedFeature.feature);
      }
    }
    return {
      type: "FeatureCollection",
      features,
    };
  },
  toFeatureCollection(features: IWrappedFeature[]): FeatureCollection {
    return {
      type: "FeatureCollection",
      features: features.map((f) => f.feature),
    };
  },
};

const WrappedFeatureLocal = z.object({
  id: z.string(),
  folderId: z.nullable(z.string()),
  at: z.string(),
  feature: z
    .object({
      type: z.literal("Feature"),
      geometry: z.nullable(
        z.union([
          z.object({
            type: z.enum([
              "MultiLineString",
              "LineString",
              "Point",
              "MultiPoint",
              "Polygon",
              "MultiPolygon",
            ]),
            coordinates: z.array(z.any()),
          }),
          z.object({
            type: z.enum(["GeometryCollection"]),
            geometries: z.array(z.any()),
          }),
        ]),
      ),
      id: z.optional(z.union([z.string(), z.number()])),
      properties: z.nullable(z.object({}).passthrough()),
    })
    .passthrough(),
});

/**
 * Symbolization --------------------------------------------------
 */

export const SymbolizationBaseInternal = z.object({
  simplestyle: z.boolean(),
  defaultColor: z.string().default(colors.indigo900),
  defaultOpacity: z
    .number()
    .default(0.3)
    .transform((num) => clamp(num, 0, 1)),
});

const SymbolizationCategorical = SymbolizationBaseInternal.extend({
  type: z.literal("categorical"),
  stops: z
    .array(
      z.object({
        input: z.union([z.string(), z.number().int()]),
        output: z.string(),
      }),
    )
    .min(1)
    .transform((stops) => {
      return uniqueStops(stops);
    }),
  property: z.string(),
});

/**
 * The previous version of symbolization ramp,
 * used for upgrading.
 */

/**
 * Make stops unique based on their 'input' value.
 */
function uniqueStops<T extends { input: JsonValue }>(stops: T[]): T[] {
  const inputs = new Set();
  const transformedStops = [];

  for (const stop of stops) {
    if (!inputs.has(stop.input)) {
      inputs.add(stop.input);
      transformedStops.push(stop);
    }
  }
  return transformedStops;
}

export const SymbolizationNone = SymbolizationBaseInternal.extend({
  type: z.literal("none"),
});

export const Symbolization = z.union([
  SymbolizationNone,
  SymbolizationCategorical,
]);

export const SYMBOLIZATION_NONE: ISymbolizationNone = {
  type: "none",
  simplestyle: true,
  defaultColor: colors.indigo900,
  defaultOpacity: 0.3,
};

export type ISymbolizationNone = z.infer<typeof SymbolizationNone>;
export type ISymbolizationCategorical = z.infer<
  typeof SymbolizationCategorical
>;
export type ISymbolization = z.infer<typeof Symbolization>;

// @ts-expect-error todo
export const WrappedFeature: z.ZodSchema<IWrappedFeature> = WrappedFeatureLocal;
// @ts-expect-error todo
export const WrappedFeatureWithoutAt: z.ZodSchema<Omit<IWrappedFeature, "at">> =
  WrappedFeatureLocal.omit({ at: true });

export type DragTarget = RawId | IWrappedFeature["id"][];

export interface HandlerContext {
  setFlatbushInstance: Dispatch<SetStateAction<FlatbushLike>>;
  selection: Sel;
  flatbushInstance: FlatbushLike;
  dragTargetRef: React.MutableRefObject<DragTarget | null>;
  mode: ModeWithOptions;
  throttledMovePointer: (e: mapboxgl.Point) => void;
  hydraulicModel: HydraulicModel;
  folderMap: FolderMap;
  idMap: IDMap;
  rep: IPersistence;
  map: MapEngine;
}

/**
 * GeometryCollection is basically the one kind of geometry
 * that breaks the norm. Everything but it.
 */
export type CoordinateHavers =
  | Polygon
  | LineString
  | MultiPoint
  | MultiPolygon
  | Point;

export type CategoricalValues = {
  property: string;
  rampName: string;
  defaultColor: string;
  defaultOpacity: number;
  simplestyle: boolean;
};
