import type { LabelManager } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import { applyChangeSet, toChangeSet } from "src/hydraulic-model/change-sets";

export const applyOperation = (
  model: HydraulicModel,
  moment: ModelMoment,
  labelManager: LabelManager,
) => {
  const changeSet = toChangeSet(model, moment);
  applyChangeSet(model, changeSet, "forward", labelManager);

  return {
    changeSet,
    undo: () => applyChangeSet(model, changeSet, "reverse", labelManager),
    redo: () => applyChangeSet(model, changeSet, "forward", labelManager),
  };
};
