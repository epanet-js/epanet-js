export type { ProjectSettings } from "./project-settings";
export { defaultProjectSettings, defaultProjectName } from "./project-settings";
export type { UnitsSpec, FormattingSpec } from "./quantities-spec";
export type { DefaultsSpec } from "@epanet-js/hydraulic-model";
export {
  getDecimals,
  getMinorLossUnit,
  getDefaultRoughness,
  withHeadlossDefaults,
} from "./quantities-spec";
