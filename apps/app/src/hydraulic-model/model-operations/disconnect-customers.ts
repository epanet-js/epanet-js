import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { ModelOperation } from "../model-operation";
import { changeSet, putCustomerPoints } from "../change-sets";

type InputData = {
  customerPointIds: readonly number[];
};

export const disconnectCustomers: ModelOperation<InputData> = (
  model,
  { customerPointIds },
) =>
  changeSet(model, "disconnectCustomers", [
    putCustomerPoints(
      disconnectedCopies(model.customerPoints, customerPointIds),
    ),
  ]);

const disconnectedCopies = (
  customerPoints: ReadonlyMap<number, CustomerPoint>,
  customerPointIds: readonly number[],
): CustomerPoint[] => {
  const disconnectedCustomerPoints: CustomerPoint[] = [];

  for (const id of customerPointIds) {
    const customerPoint = customerPoints.get(id);
    if (!customerPoint) {
      throw new Error(`Customer point with id ${id} not found`);
    }

    const disconnectedCopy = customerPoint.copyDisconnected();
    disconnectedCustomerPoints.push(disconnectedCopy);
  }

  return disconnectedCustomerPoints;
};
