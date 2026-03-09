import { Position } from "src/types";
import { CustomerPoint } from "../customer-points";
import { ModelOperation } from "../model-operation";

type InputData = {
  coordinates: Position;
};

export const addCustomerPoint: ModelOperation<InputData> = (
  { customerPoints },
  { coordinates },
) => {
  const id = nextCustomerPointId(customerPoints);
  const label = String(id);
  const customerPoint = CustomerPoint.build(id, coordinates, { label });

  return {
    note: "Add customer point",
    putCustomerPoints: [customerPoint],
  };
};

const nextCustomerPointId = (customerPoints: Map<number, unknown>): number => {
  if (customerPoints.size === 0) return 1;
  return Math.max(...customerPoints.keys()) + 1;
};
