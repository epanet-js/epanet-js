import { Position } from "src/types";
import { ModelOperation } from "../model-operation";

type InputData = {
  coordinates: Position;
};

export const addCustomerPoint: ModelOperation<InputData> = (
  { customerPointFactory },
  { coordinates },
) => {
  const customerPoint = customerPointFactory.create(coordinates);

  return {
    note: "Add customer point",
    putCustomerPoints: [customerPoint],
  };
};
