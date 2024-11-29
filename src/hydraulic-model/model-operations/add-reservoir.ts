import { Reservoir } from "../asset-types";
import { ModelOperation } from "../model-operation";

type InputData = {
  reservoir: Reservoir;
};

export const addReservoir: ModelOperation<InputData> = (_, { reservoir }) => {
  return {
    note: "Add reservoir",
    putAssets: [reservoir],
  };
};
