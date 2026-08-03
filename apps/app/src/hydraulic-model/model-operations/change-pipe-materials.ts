import { PipeMaterial } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";

type InputData = PipeMaterial[];

export const changePipeMaterials: ModelOperation<InputData> = (
  _model,
  pipeMaterials,
) => {
  return {
    note: "Change pipe library",
    putPipeMaterials: pipeMaterials,
  };
};
