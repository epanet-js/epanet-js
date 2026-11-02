import type { ChangeSet } from "@epanet-js/change-set";
import type { LabelManager } from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "@epanet-js/hydraulic-model";
import { applyChangeSet } from "../change-sets";

export const applyOperation = (
  model: HydraulicModel,
  changeSet: ChangeSet,
  labelManager: LabelManager,
) => {
  applyChangeSet(model, changeSet, "forward", labelManager);

  return {
    changeSet,
    undo: () => applyChangeSet(model, changeSet, "reverse", labelManager),
    redo: () => applyChangeSet(model, changeSet, "forward", labelManager),
  };
};
