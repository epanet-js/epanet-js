import {
  HydraulicModel,
  AssetsMap,
  updateHydraulicModelAssets,
} from "src/hydraulic-model/hydraulic-model";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { Junction } from "src/hydraulic-model/asset-types/junction";
import { CustomerPointsLookup } from "src/hydraulic-model/customer-points-lookup";

type AddCustomerPointsOptions = {
  preserveJunctionDemands?: boolean;
  overrideExisting?: boolean;
};

export const addCustomerPoints = (
  hydraulicModel: HydraulicModel,
  customerPointsToAdd: CustomerPoint[],
  options: AddCustomerPointsOptions = {},
): HydraulicModel => {
  const { preserveJunctionDemands = true, overrideExisting = false } = options;
  const updatedAssets = new Map(hydraulicModel.assets);
  const updatedCustomerPoints = overrideExisting
    ? new Map()
    : new Map(hydraulicModel.customerPoints);
  const updatedLookup = overrideExisting
    ? new CustomerPointsLookup()
    : hydraulicModel.customerPointsLookup.copy();

  const modifiedJunctions = new Set<number>();

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

  const updatedHydraulicModel = updateHydraulicModelAssets(
    hydraulicModel,
    updatedAssets,
  );

  return {
    ...updatedHydraulicModel,
    version: hydraulicModel.version,
    customerPoints: updatedCustomerPoints,
    customerPointsLookup: updatedLookup,
  };
};

const removeJunctionDemands = (
  customerPoint: CustomerPoint,
  hydraulicModel: HydraulicModel,
  updatedAssets: AssetsMap,
  modifiedJunctions: Set<number>,
): void => {
  const junctionId = customerPoint.connection!.junctionId;
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
