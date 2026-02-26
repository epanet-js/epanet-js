import { Position } from "src/types";
import { CustomerPoint, CustomerPointId } from "../customer-points";
import { ModelOperation } from "../model-operation";

type InputData = {
  customerPointId: CustomerPointId;
  newCoordinates: Position;
};

export const moveCustomerPoint: ModelOperation<InputData> = (
  { customerPoints },
  { customerPointId, newCoordinates },
) => {
  const customerPoint = customerPoints.get(customerPointId);
  if (!customerPoint) {
    throw new Error(`Customer point ${customerPointId} not found`);
  }

  const movedCopy = new CustomerPoint(customerPointId, newCoordinates, {
    label: customerPoint.label,
  });

  if (customerPoint.connection) {
    movedCopy.connect(customerPoint.connection);
  }

  return {
    note: "Move customer point",
    putCustomerPoints: [movedCopy],
  };
};
