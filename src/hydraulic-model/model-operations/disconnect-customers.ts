import { CustomerPoint } from "../customer-points";
import { ModelOperation } from "../model-operation";

type InputData = {
  customerPointIds: readonly number[];
};

export const disconnectCustomers: ModelOperation<InputData> = (
  { customerPoints },
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
  }

  return {
    note: "Disconnect customers",
    putCustomerPoints: disconnectedCustomerPoints,
  };
};
