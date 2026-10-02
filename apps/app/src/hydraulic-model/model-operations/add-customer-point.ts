import { Position } from "src/types";
import { CustomerPointFactory } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { changeSet, putCustomerPoints } from "../change-sets";

type InputData = {
  coordinates: Position;
  customerPointFactory: CustomerPointFactory;
};

export const addCustomerPoint: ModelOperation<InputData> = (
  model,
  { coordinates, customerPointFactory },
) =>
  changeSet(model, "addCustomerPoint", [
    putCustomerPoints([customerPointFactory.create(coordinates)]),
  ]);

export const addCustomerPointDeprecated: ModelOperationDeprecated<InputData> = (
  _model,
  { coordinates, customerPointFactory },
) => {
  const customerPoint = customerPointFactory.create(coordinates);

  return {
    note: "addCustomerPoint",
    putCustomerPoints: [customerPoint],
  };
};
