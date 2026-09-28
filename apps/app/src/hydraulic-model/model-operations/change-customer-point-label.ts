import { CustomerPointId } from "@epanet-js/hydraulic-model";
import { ModelOperationDeprecated } from "../model-operation";
import { changeCustomerPointPropertyDeprecated } from "./change-customer-point-property";

type InputData = {
  customerPointId: CustomerPointId;
  newLabel: string;
};

export const changeCustomerPointLabel: ModelOperationDeprecated<InputData> = (
  hydraulicModel,
  { customerPointId, newLabel },
) => {
  return changeCustomerPointPropertyDeprecated(hydraulicModel, {
    customerPointIds: [customerPointId],
    property: "label",
    value: newLabel,
  });
};
