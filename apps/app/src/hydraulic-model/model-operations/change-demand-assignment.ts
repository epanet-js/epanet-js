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
) => changeSet(model, "changeDemandAssignment", [setDemands(assignments)]);

export const changeDemandAssignmentDeprecated: ModelOperationDeprecated<
  InputData
> = (_model, assignments) => {
  return {
    note: "changeDemandAssignment",
    putDemands: { assignments },
  };
};
