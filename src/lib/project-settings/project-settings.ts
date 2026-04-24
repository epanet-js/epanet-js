import {
  UnitsSpec,
  DefaultsSpec,
  FormattingSpec,
  presets,
} from "./quantities-spec";
import { Projection, WGS84 } from "src/lib/projections";
import { HeadlossFormula } from "src/hydraulic-model/asset-types/pipe";

export const defaultProjectName = "";

export type ProjectSettings = {
  name: string;
  units: UnitsSpec;
  defaults: DefaultsSpec;
  headlossFormula: HeadlossFormula;
  formatting: FormattingSpec;
  projection: Projection;
};

export const defaultProjectSettings: ProjectSettings = {
  name: defaultProjectName,
  units: presets.LPS.units,
  defaults: presets.LPS.defaults,
  headlossFormula: "H-W",
  formatting: { decimals: presets.LPS.decimals, defaultDecimals: 3 },
  projection: WGS84,
};
