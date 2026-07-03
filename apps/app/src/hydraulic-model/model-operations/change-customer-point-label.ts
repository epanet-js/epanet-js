import { CustomerPointId } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeCustomerPointProperty } from "./change-customer-point-property";

type InputData = {
  customerPointId: CustomerPointId;
  newLabel: string;
};

export const changeCustomerPointLabel: ModelOperation<InputData> = (
  hydraulicModel,
  { customerPointId, newLabel },
) => {
  return changeCustomerPointProperty(hydraulicModel, {
    customerPointIds: [customerPointId],
    property: "label",
    value: newLabel,
  });
};
