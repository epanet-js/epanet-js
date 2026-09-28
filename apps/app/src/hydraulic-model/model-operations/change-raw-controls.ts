import { RawControls } from "@epanet-js/hydraulic-model";
import { ModelOperationDeprecated } from "../model-operation";

export const changeRawControls: ModelOperationDeprecated<RawControls> = (
  _,
  rawControls,
) => {
  return {
    note: "Change controls",
    putRawControls: rawControls,
  };
};
