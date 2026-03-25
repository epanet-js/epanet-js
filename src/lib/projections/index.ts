export type {
  Projection,
  CanonicalProjection,
  XYGridProjection,
  Proj4Projection,
} from "./projection";
export { WGS84 } from "./projection";
export type { ProjectionMapper } from "./projection-mapper";
export { createProjectionMapper, getBackdropUnits } from "./projection-mapper";
