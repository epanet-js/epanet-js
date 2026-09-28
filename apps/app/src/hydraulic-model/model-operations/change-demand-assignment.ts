import { DemandAssignment, ModelOperationDeprecated } from "../model-operation";

type InputData = DemandAssignment[];

export const changeDemandAssignment: ModelOperationDeprecated<InputData> = (
  _model,
  assignments,
) => {
  return {
    note: "Change demand assignment",
    putDemands: { assignments },
  };
};
