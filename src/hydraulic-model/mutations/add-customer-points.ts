import { HydraulicModel, AssetsMap } from "src/hydraulic-model/hydraulic-model";
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
  const updatedLookup = hydraulicModel.customerPointsLookup.copy();

  const modifiedJunctions = new Set<string>();

  for (const customerPoint of customerPointsToAdd) {
    updatedCustomerPoints.set(customerPoint.id, customerPoint);

    if (customerPoint.connection) {
      updatedLookup.addConnection(customerPoint);
    }

    if (!customerPoint.connection || !customerPoint.connection.junctionId) {
      continue;
    }

    if (!preserveJunctionDemands) {
      removeJunctionDemands(
        customerPoint,
        hydraulicModel,
        updatedAssets,
        modifiedJunctions,
      );
    }
  }

  return {
    ...hydraulicModel,
    version: hydraulicModel.version,
    customerPoints: updatedCustomerPoints,
    customerPointsLookup: updatedLookup,
    assets: updatedAssets,
  };
};

const removeJunctionDemands = (
  customerPoint: CustomerPoint,
  hydraulicModel: HydraulicModel,
  updatedAssets: AssetsMap,
  modifiedJunctions: Set<string>,
): void => {
  const junctionId = customerPoint.connection!.junctionId!;
  const originalJunction = hydraulicModel.assets.get(junctionId) as Junction;

  if (!originalJunction) {
    return;
  }

  if (!modifiedJunctions.has(junctionId)) {
    const junctionCopy = originalJunction.copy();
    junctionCopy.setBaseDemand(0);
    updatedAssets.set(junctionId, junctionCopy);
    modifiedJunctions.add(junctionId);
  }
};
