import { CustomerPoint, CustomerPointId } from "../customer-points";
import { ModelOperation } from "../model-operation";

type InputData = {
  customerPointId: CustomerPointId;
  newLabel: string;
};

export const changeCustomerPointLabel: ModelOperation<InputData> = (
  { customerPoints },
  { customerPointId, newLabel },
) => {
  const customerPoint = customerPoints.get(customerPointId);
  if (!customerPoint) {
    throw new Error(`Customer point ${customerPointId} not found`);
  }

  const updated = new CustomerPoint(
    customerPointId,
    customerPoint.coordinates,
    {
      label: newLabel,
    },
  );

  if (customerPoint.connection) {
    updated.connect(customerPoint.connection);
  }

  return {
    note: "Change customer point label",
    putCustomerPoints: [updated],
  };
};
