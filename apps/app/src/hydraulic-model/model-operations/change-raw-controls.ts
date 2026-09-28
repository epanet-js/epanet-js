import { RawControls } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { changeSet, setRawControls } from "../change-sets";

export const changeRawControls: ModelOperation<RawControls> = (
  model,
  rawControls,
) => changeSet(model, "Change controls", [setRawControls(rawControls)]);

export const changeRawControlsDeprecated: ModelOperationDeprecated<
  RawControls
> = (_, rawControls) => {
  return {
    note: "Change controls",
    putRawControls: rawControls,
  };
};
