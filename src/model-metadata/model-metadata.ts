import { Quantities, UnitsSpec, DefaultsSpec } from "./quantities-spec";
import { ProjectionMapper } from "src/projections";
import { HeadlossFormula } from "src/hydraulic-model/asset-types/pipe";

export type ModelMetadata = {
  quantities: Quantities;
  units: UnitsSpec;
  defaults: DefaultsSpec;
  headlossFormula: HeadlossFormula;
  projectionMapper: ProjectionMapper;
};
