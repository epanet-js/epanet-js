import {
  UnitsSpec,
  DefaultsSpec,
  FormattingSpec,
  presets,
} from "./quantities-spec";
import { ProjectionMapper, createProjectionMapper } from "src/projections";
import { HeadlossFormula } from "src/hydraulic-model/asset-types/pipe";

export type ProjectSettings = {
  units: UnitsSpec;
  defaults: DefaultsSpec;
  headlossFormula: HeadlossFormula;
  formatting: FormattingSpec;
  projectionMapper: ProjectionMapper;
};

export const defaultProjectSettings: ProjectSettings = {
  units: presets.LPS.units,
  defaults: presets.LPS.defaults,
  headlossFormula: "H-W",
  formatting: { decimals: presets.LPS.decimals, defaultDecimals: 3 },
  projectionMapper: createProjectionMapper({ type: "wgs84" }),
};
