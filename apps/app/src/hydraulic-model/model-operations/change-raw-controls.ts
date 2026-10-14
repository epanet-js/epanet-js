import { RawControls } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, setRawControls } from "../change-sets";

export const changeRawControls: ModelOperation<RawControls> = (
  model,
  rawControls,
) => changeSet(model, "changeRawControls", [setRawControls(rawControls)]);
