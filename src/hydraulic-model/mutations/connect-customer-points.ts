import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { CustomerPoints } from "src/hydraulic-model/customer-points";
import { Junction } from "src/hydraulic-model/asset-types/junction";

type ConnectCustomerPointsOptions = {
  preserveJunctionDemands?: boolean;
};

export const connectCustomerPoints = (
  hydraulicModel: HydraulicModel,
  customerPoints: CustomerPoints,
  options: ConnectCustomerPointsOptions = {},
): HydraulicModel => {
  const { preserveJunctionDemands = true } = options;
  const updatedAssets = new Map(hydraulicModel.assets);
  const updatedCustomerPoints = new Map(hydraulicModel.customerPoints);

  const modifiedJunctions = new Set<string>();

  for (const [customerPointId, customerPoint] of customerPoints) {
    if (!customerPoint.connection || !customerPoint.connection.junction) {
      continue;
    }

    const junctionId = customerPoint.connection.junction.id;
    const originalJunction = hydraulicModel.assets.get(junctionId) as Junction;

    if (!originalJunction) {
      continue;
    }

    let junctionCopy: Junction;
    if (!modifiedJunctions.has(junctionId)) {
      junctionCopy = originalJunction.copy();
      junctionCopy.customerPoints.forEach((existingCustomerPoint) => {
        junctionCopy.removeCustomerPoint(existingCustomerPoint);
      });
      if (!preserveJunctionDemands) {
        junctionCopy.setBaseDemand(0);
      }
      updatedAssets.set(junctionId, junctionCopy);
      modifiedJunctions.add(junctionId);
    } else {
      junctionCopy = updatedAssets.get(junctionId) as Junction;
    }

    updatedCustomerPoints.set(customerPointId, customerPoint);

    junctionCopy.assignCustomerPoint(customerPoint);
  }

  return {
    ...hydraulicModel,
    version: hydraulicModel.version,
    customerPoints: updatedCustomerPoints,
    assets: updatedAssets,
  };
};
