import {
  Rule,
  ValidationIssues,
  modelAttributesValidationSteps,
} from "@epanet-js/network-review";
import { HydraulicModel } from "src/hydraulic-model";
import { createTimeSlicer } from "src/infra/yield-to-main";
import { throwIfAborted } from "src/infra/abort";

export {
  validateAsset,
  countValidationIssues,
} from "@epanet-js/network-review";

export const validateModelAttributes = async (
  model: HydraulicModel,
  options: { rules?: Rule[]; signal?: AbortSignal } = {},
): Promise<ValidationIssues> => {
  const { rules, signal } = options;
  throwIfAborted(signal);

  const steps = modelAttributesValidationSteps(model, { rules });
  const yieldIfSliceElapsed = createTimeSlicer();

  let step = steps.next();
  while (!step.done) {
    await yieldIfSliceElapsed();
    throwIfAborted(signal);
    step = steps.next();
  }
  return step.value;
};
