import { Position } from "src/types";
import { CustomerPoint, CustomerPointId } from "@epanet-js/hydraulic-model";
import { ModelOperation, ModelOperationDeprecated } from "../model-operation";
import { HydraulicModel } from "../hydraulic-model";
import { changeSet, putCustomerPoints } from "../change-sets";

type InputData = {
  customerPointId: CustomerPointId;
  newCoordinates: Position;
};

export const moveCustomerPoint: ModelOperation<InputData> = (
  hydraulicModel,
  { customerPointId, newCoordinates },
) =>
  changeSet(hydraulicModel, "moveCustomerPoint", [
    putCustomerPoints([
      buildMovedCopy(hydraulicModel, customerPointId, newCoordinates),
    ]),
  ]);

export const moveCustomerPointDeprecated: ModelOperationDeprecated<
  InputData
> = (hydraulicModel, { customerPointId, newCoordinates }) => ({
  note: "moveCustomerPoint",
  putCustomerPoints: [
    buildMovedCopy(hydraulicModel, customerPointId, newCoordinates),
  ],
});

const buildMovedCopy = (
  { customerPoints }: HydraulicModel,
  customerPointId: CustomerPointId,
  newCoordinates: Position,
): CustomerPoint => {
  const customerPoint = customerPoints.get(customerPointId);
  if (!customerPoint) {
    throw new Error(`Customer point ${customerPointId} not found`);
  }

  return customerPoint.copyWithCoordinates(newCoordinates);
};
