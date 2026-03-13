import { Quantities, UnitsSpec, DefaultsSpec } from "./quantities-spec";
import { ProjectionMapper } from "src/projections";

export type ModelMetadata = {
  quantities: Quantities;
  units: UnitsSpec;
  defaults: DefaultsSpec;
  projectionMapper: ProjectionMapper;
};
