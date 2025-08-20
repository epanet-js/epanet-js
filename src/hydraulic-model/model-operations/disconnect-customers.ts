import { CustomerPoint } from "../customer-points";
import { ModelOperation } from "../model-operation";
import { Junction } from "../asset-types/junction";
import { Asset } from "../asset-types";

type InputData = {
  customerPointIds: readonly string[];
};

export const disconnectCustomers: ModelOperation<InputData> = (
  { customerPoints, assets },
  { customerPointIds },
) => {
  const disconnectedCustomerPoints: CustomerPoint[] = [];
  const modifiedJunctions = new Map<string, Junction>();

  for (const id of customerPointIds) {
    const customerPoint = customerPoints.get(id);
    if (!customerPoint) {
      throw new Error(`Customer point with id ${id} not found`);
    }

    const disconnectedCopy = customerPoint.copy();
    disconnectedCustomerPoints.push(disconnectedCopy);

    if (customerPoint.connection?.junctionId) {
      const junctionId = customerPoint.connection.junctionId;
      const originalJunction = assets.get(junctionId) as Junction;

      if (originalJunction) {
        let junctionCopy: Junction;
        if (modifiedJunctions.has(junctionId)) {
          junctionCopy = modifiedJunctions.get(junctionId)!;
        } else {
          junctionCopy = originalJunction.copy();
          modifiedJunctions.set(junctionId, junctionCopy);
        }

        junctionCopy.removeCustomerPoint(customerPoint.id);
      }
    }
  }

  const putAssets: Asset[] = Array.from(modifiedJunctions.values());

  return {
    note: "Disconnect customers",
    putCustomerPoints: disconnectedCustomerPoints,
    ...(putAssets.length > 0 && { putAssets }),
  };
};
