import { DemandAssignment, ModelOperation } from "../model-operation";
import { changeSet, setDemands } from "../change-sets";

type InputData = DemandAssignment[];

export const changeDemandAssignment: ModelOperation<InputData> = (
  model,
  assignments,
) => changeSet(model, "changeDemandAssignment", [setDemands(assignments)]);
