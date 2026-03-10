import { Position } from "src/types";
import { CustomerPoint } from "../customer-points";
import { ModelOperation } from "../model-operation";

type InputData = {
  coordinates: Position;
};

export const addCustomerPoint: ModelOperation<InputData> = (
  { customerPointIdGenerator },
  { coordinates },
) => {
  const id = customerPointIdGenerator.newId();
  const label = String(id);
  const customerPoint = CustomerPoint.build(id, coordinates, { label });

  return {
    note: "Add customer point",
    putCustomerPoints: [customerPoint],
  };
};
