export type { ProjectSettings } from "./project-settings";
export { defaultProjectSettings } from "./project-settings";
export type {
  UnitsSpec,
  DefaultsSpec,
  FormattingSpec,
} from "./quantities-spec";
export {
  getDecimals,
  getMinorLossUnit,
  getDefaultRoughness,
  withHeadlossDefaults,
} from "./quantities-spec";
