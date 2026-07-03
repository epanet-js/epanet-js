import { Position } from "src/types";
import { CustomerPointId } from "@epanet-js/hydraulic-model";
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

  const movedCopy = customerPoint.copyWithCoordinates(newCoordinates);

  return {
    note: "Move customer point",
    putCustomerPoints: [movedCopy],
  };
};
