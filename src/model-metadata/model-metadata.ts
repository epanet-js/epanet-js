import { Quantities, UnitsSpec } from "./quantities-spec";
import { ProjectionMapper } from "src/projections";

export type ModelMetadata = {
  quantities: Quantities;
  units: UnitsSpec;
  projectionMapper: ProjectionMapper;
};
