import { RawControls } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";

export const changeRawControls: ModelOperation<RawControls> = (
  _,
  rawControls,
) => {
  return {
    note: "Change controls",
    putRawControls: rawControls,
  };
};
