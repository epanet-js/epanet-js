import { RawControls } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { changeSet, setRawControls } from "../change-sets";

export const changeRawControls: ModelOperation<RawControls> = (
  model,
  rawControls,
) => changeSet(model, "changeRawControls", [setRawControls(rawControls)]);

export const changeRawControlsDeprecated: ModelOperationDeprecated<
  RawControls
> = (_, rawControls) => {
  return {
    note: "changeRawControls",
    putRawControls: rawControls,
  };
};
