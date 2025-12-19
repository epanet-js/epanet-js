import { Controls } from "../controls";
import { ModelOperation } from "../model-operation";

export const changeControls: ModelOperation<Controls> = (_, controls) => {
  return {
    note: "Change controls",
    putControls: controls,
  };
};
