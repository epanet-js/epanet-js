import {
  HydraulicModel,
  updateHydraulicModelAssets,
} from "src/hydraulic-model/hydraulic-model";
import {
  CustomerPoint,
  CustomerPointsLookup,
} from "@epanet-js/hydraulic-model";
import { Demand } from "@epanet-js/hydraulic-model";

type AddCustomerPointsOptions = {
  preserveJunctionDemands?: boolean;
  customerPointDemands?: Map<number, Demand[]>;
};

export const addCustomerPoints = (
  hydraulicModel: HydraulicModel,
  customerPointsToAdd: CustomerPoint[],
  options: AddCustomerPointsOptions = {},
): HydraulicModel => {
  const { preserveJunctionDemands = true } = options;
  const updatedAssets = new Map(hydraulicModel.assets);
  const updatedCustomerPoints = new Map();
  const updatedLookup = new CustomerPointsLookup();

  for (const customerPoint of customerPointsToAdd) {
    updatedCustomerPoints.set(customerPoint.id, customerPoint);
  }

  const updatedHydraulicModel = updateHydraulicModelAssets(
    hydraulicModel,
    updatedAssets,
  );

  const updatedJunctionDemands = !preserveJunctionDemands
    ? new Map<number, Demand[]>()
    : hydraulicModel.demands.junctions;

  const updatedCustomerDemands = new Map<number, Demand[]>();

  if (options.customerPointDemands) {
    for (const [cpId, demands] of options.customerPointDemands) {
      updatedCustomerDemands.set(cpId, demands);
    }
  }

  const demandsChanged =
    !preserveJunctionDemands ||
    (options.customerPointDemands && options.customerPointDemands.size > 0);

  return {
    ...updatedHydraulicModel,
    version: hydraulicModel.version,
    customerPoints: updatedCustomerPoints,
    customerPointsLookup: updatedLookup,
    demands: demandsChanged
      ? {
          ...hydraulicModel.demands,
          junctions: updatedJunctionDemands,
          customerPoints: updatedCustomerDemands,
        }
      : hydraulicModel.demands,
  };
};
