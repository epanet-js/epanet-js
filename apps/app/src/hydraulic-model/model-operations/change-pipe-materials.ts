import { PipeMaterial } from "@epanet-js/hydraulic-model";
import { ModelOperationDeprecated } from "../model-operation";

type InputData = PipeMaterial[];

export const changePipeMaterials: ModelOperationDeprecated<InputData> = (
  _model,
  pipeMaterials,
) => {
  return {
    note: "Change pipe library",
    putPipeMaterials: pipeMaterials,
  };
};
