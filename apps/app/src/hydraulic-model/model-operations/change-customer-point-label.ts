import { CustomerPointId } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import {
  changeCustomerPointProperty,
  changeCustomerPointPropertyDeprecated,
} from "./change-customer-point-property";

type InputData = {
  customerPointId: CustomerPointId;
  newLabel: string;
};

export const changeCustomerPointLabel: ModelOperation<InputData> = (
  hydraulicModel,
  { customerPointId, newLabel },
) =>
  changeCustomerPointProperty(hydraulicModel, {
    customerPointIds: [customerPointId],
    property: "label",
    value: newLabel,
  });

export const changeCustomerPointLabelDeprecated: ModelOperationDeprecated<
  InputData
> = (hydraulicModel, { customerPointId, newLabel }) => {
  return changeCustomerPointPropertyDeprecated(hydraulicModel, {
    customerPointIds: [customerPointId],
    property: "label",
    value: newLabel,
  });
};
