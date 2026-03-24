export type { Projection, ProjectionConfig } from "./projection";
export { WGS84, XY_GRID, projectionFromId } from "./projection";
export type { ProjectionMapper } from "./projection-mapper";
export {
  createProjectionMapper,
  buildProjectionConfig,
  getBackdropUnits,
} from "./projection-mapper";
