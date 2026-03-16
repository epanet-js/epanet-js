import { UnitsSpec, DefaultsSpec, FormattingSpec } from "./quantities-spec";
import { ProjectionMapper } from "src/projections";
import { HeadlossFormula } from "src/hydraulic-model/asset-types/pipe";

export type ModelMetadata = {
  units: UnitsSpec;
  defaults: DefaultsSpec;
  headlossFormula: HeadlossFormula;
  formatting: FormattingSpec;
  projectionMapper: ProjectionMapper;
};
