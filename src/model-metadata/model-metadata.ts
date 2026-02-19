import { Quantities } from "./quantities-spec";
import { ProjectionMapper } from "src/projections";

export type ModelMetadata = {
  quantities: Quantities;
  projectionMapper: ProjectionMapper;
};
