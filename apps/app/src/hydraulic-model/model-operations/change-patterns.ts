import { Patterns } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, replacePatterns } from "../change-sets";

type InputData = Patterns;

export const changePatterns: ModelOperation<InputData> = (model, patterns) =>
  changeSet(model, "changePatterns", [replacePatterns(patterns)]);
