import { CustomerPoint } from "../customer-points";
import { ModelOperation } from "../model-operation";

type InputData = {
  customerPointIds: readonly string[];
};

export const disconnectCustomers: ModelOperation<InputData> = (
  { customerPoints, customerPointsLookup },
  { customerPointIds },
) => {
  const disconnectedCustomerPoints: CustomerPoint[] = [];

  for (const id of customerPointIds) {
    const customerPoint = customerPoints.get(id);
    if (!customerPoint) {
      throw new Error(`Customer point with id ${id} not found`);
    }

    const disconnectedCopy = customerPoint.copyDisconnected();
    disconnectedCustomerPoints.push(disconnectedCopy);

    customerPointsLookup.removeConnection(customerPoint);
    customerPointsLookup.addConnection(disconnectedCopy);
  }

  return {
    note: "Disconnect customers",
    putCustomerPoints: disconnectedCustomerPoints,
  };
};
