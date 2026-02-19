export type { Projection, ProjectionConfig } from "./projection";
export type { ProjectionMapper } from "./projection-mapper";
export {
  createProjectionMapper,
  buildProjectionMapper,
} from "./projection-mapper";
export {
  METERS_PER_DEGREE,
  computeCentroid,
  transformPoint,
  inverseTransformPoint,
} from "./xy-grid-transform";
