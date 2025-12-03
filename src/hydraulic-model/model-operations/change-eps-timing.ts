import { EPSTiming } from "../eps-timing";
import { ModelOperation } from "../model-operation";

export const changeEPSTiming: ModelOperation<EPSTiming> = (_, epsTiming) => {
  return {
    note: "Change EPS timing",
    putEPSTiming: epsTiming,
  };
};
