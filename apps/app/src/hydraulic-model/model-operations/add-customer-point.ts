import { Position } from "src/types";
import { CustomerPointFactory } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";

type InputData = {
  coordinates: Position;
  customerPointFactory: CustomerPointFactory;
};

export const addCustomerPoint: ModelOperation<InputData> = (
  _model,
  { coordinates, customerPointFactory },
) => {
  const customerPoint = customerPointFactory.create(coordinates);

  return {
    note: "Add customer point",
    putCustomerPoints: [customerPoint],
  };
};
