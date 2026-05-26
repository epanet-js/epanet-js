import { DemandAssignment, ModelOperation } from "../model-operation";

type InputData = DemandAssignment[];

export const changeDemandAssignment: ModelOperation<InputData> = (
  _model,
  assignments,
) => {
  return {
    note: "Change demand assignment",
    putDemands: { assignments },
  };
};
