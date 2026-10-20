import {
  buildInp as buildInpUninstrumented,
  buildInpToFile as buildInpToFileUninstrumented,
} from "@epanet-js/simulation";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";

export {
  chooseUnitSystem,
  isUsUnitSystem,
  getLsxRequirements,
  defaultAccuracy,
  defaultUnbalanced,
  defaultCustomersPatternId,
  type BuildOptions,
  type EpanetUnitSystem,
  type LsxRequirements,
} from "@epanet-js/simulation";

export const buildInp = withDebugInstrumentation(buildInpUninstrumented, {
  name: "BUILD_INP",
  maxDurationMs: 1000,
});

export const buildInpToFile = withDebugInstrumentation(
  buildInpToFileUninstrumented,
  { name: "BUILD_INP_TO_FILE", maxDurationMs: 1000 },
);
