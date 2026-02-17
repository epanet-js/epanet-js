import {
  HydraulicModel,
  updateHydraulicModelAssets,
} from "src/hydraulic-model/hydraulic-model";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { CustomerPointsLookup } from "src/hydraulic-model/customer-points-lookup";
import { Demand } from "src/hydraulic-model/demands";

type AddCustomerPointsOptions = {
  preserveJunctionDemands?: boolean;
  overrideExisting?: boolean;
  customerPointDemands?: Map<number, Demand[]>;
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

  const junctionsToClearDemands = new Set<number>();

  for (const customerPoint of customerPointsToAdd) {
    updatedCustomerPoints.set(customerPoint.id, customerPoint);

    if (customerPoint.connection) {
      updatedLookup.addConnection(customerPoint);
    }

    if (!customerPoint.connection || !customerPoint.connection.junctionId) {
      continue;
    }

    if (!preserveJunctionDemands) {
      junctionsToClearDemands.add(customerPoint.connection.junctionId);
    }
  }

  const updatedHydraulicModel = updateHydraulicModelAssets(
    hydraulicModel,
    updatedAssets,
  );

  const updatedJunctionDemands =
    junctionsToClearDemands.size > 0
      ? new Map(hydraulicModel.demands.assignments.junctions)
      : hydraulicModel.demands.assignments.junctions;

  for (const junctionId of junctionsToClearDemands) {
    updatedJunctionDemands.delete(junctionId);
  }

  const updatedCustomerDemands = overrideExisting
    ? new Map<number, Demand[]>()
    : new Map(hydraulicModel.demands.assignments.customerPoints);

  if (options.customerPointDemands) {
    for (const [cpId, demands] of options.customerPointDemands) {
      updatedCustomerDemands.set(cpId, demands);
    }
  }

  const demandsChanged =
    junctionsToClearDemands.size > 0 ||
    (options.customerPointDemands && options.customerPointDemands.size > 0) ||
    overrideExisting;

  return {
    ...updatedHydraulicModel,
    version: hydraulicModel.version,
    customerPoints: updatedCustomerPoints,
    customerPointsLookup: updatedLookup,
    demands: demandsChanged
      ? {
          ...hydraulicModel.demands,
          assignments: {
            junctions: updatedJunctionDemands,
            customerPoints: updatedCustomerDemands,
          },
        }
      : hydraulicModel.demands,
  };
};
