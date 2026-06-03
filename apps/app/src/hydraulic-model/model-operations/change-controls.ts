import { Controls } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";

export const changeControls: ModelOperation<Controls> = (_, controls) => {
  return {
    note: "Change controls",
    putControls: controls,
  };
};
