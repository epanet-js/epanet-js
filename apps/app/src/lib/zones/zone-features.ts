import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { CoordinateConversion } from "src/lib/gis-import/types";

export type ZoneFeature = Feature<Polygon | MultiPolygon>;

type ReadZoneFeaturesError =
  | "invalidFile"
  | "noPolygons"
  | "unsupportedProjection"
  | "invalidProjection";

export type ReadZoneFeaturesResult = {
  error?: ReadZoneFeaturesError;
  features: ZoneFeature[];
  uniqueProperties: Set<string>;
  coordinateConversion?: CoordinateConversion;
};
