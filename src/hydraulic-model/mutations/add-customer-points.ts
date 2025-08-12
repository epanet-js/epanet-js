import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { Junction } from "src/hydraulic-model/asset-types/junction";

type AddCustomerPointsOptions = {
  preserveJunctionDemands?: boolean;
};

export const addCustomerPoints = (
  hydraulicModel: HydraulicModel,
  customerPointsToAdd: CustomerPoint[],
  options: AddCustomerPointsOptions = {},
): HydraulicModel => {
  const { preserveJunctionDemands = true } = options;
  const updatedAssets = new Map(hydraulicModel.assets);
  const updatedCustomerPoints = new Map(hydraulicModel.customerPoints);

  const modifiedJunctions = new Set<string>();

  for (const customerPoint of customerPointsToAdd) {
    updatedCustomerPoints.set(customerPoint.id, customerPoint);

    if (!customerPoint.connection || !customerPoint.connection.junctionId) {
      continue;
    }

    const junctionId = customerPoint.connection.junctionId;
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

    junctionCopy.assignCustomerPoint(customerPoint);
  }

  return {
    ...hydraulicModel,
    version: hydraulicModel.version,
    customerPoints: updatedCustomerPoints,
    assets: updatedAssets,
  };
};
