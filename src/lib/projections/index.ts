export type {
  Projection,
  CanonicalProjection,
  XYGridProjection,
  Proj4Projection,
} from "./projection";
export { WGS84 } from "./projection";
export { getEsriWktString } from "./esri-wkt";
export type { ProjectionMapper } from "./projection-mapper";
export { createProjectionMapper, getBackdropUnits } from "./projection-mapper";
export { inverseProjectGeoJson } from "./inverse-project-geojson";
