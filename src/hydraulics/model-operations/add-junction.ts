import { Junction } from "../asset-types";
import { ModelOperation } from "../model-operation";

type InputData = {
  junction: Junction;
};

export const addJunction: ModelOperation<InputData> = (_, { junction }) => {
  return {
    note: "Add junction",
    putAssets: [junction],
  };
};
