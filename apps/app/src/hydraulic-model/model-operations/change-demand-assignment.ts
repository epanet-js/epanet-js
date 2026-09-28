import {
  DemandAssignment,
  ModelOperation,
  ModelOperationDeprecated,
} from "../model-operation";
import { changeSet, setDemands } from "../change-sets";

type InputData = DemandAssignment[];

export const changeDemandAssignment: ModelOperation<InputData> = (
  model,
  assignments,
) => changeSet(model, "Change demand assignment", [setDemands(assignments)]);

export const changeDemandAssignmentDeprecated: ModelOperationDeprecated<
  InputData
> = (_model, assignments) => {
  return {
    note: "Change demand assignment",
    putDemands: { assignments },
  };
};
