import {
  CustomAttributesDefinition,
  CustomerPoint,
  CustomerPointId,
  Demand,
  HydraulicModel,
} from "@epanet-js/hydraulic-model";
import { DemandAssignment, ModelOperation } from "../model-operation";
import {
  changeSet,
  dropCustomerPoints,
  putCustomerPoints,
  replaceCustomAttributes,
  setDemands,
} from "../change-sets";

type InputData = {
  customerPoints: readonly CustomerPoint[];
  customerPointDemands: ReadonlyMap<CustomerPointId, Demand[]>;
  preserveJunctionDemands: boolean;
  customAttributes?: CustomAttributesDefinition;
};

export const replaceCustomerPoints: ModelOperation<InputData> = (
  hydraulicModel,
  {
    customerPoints,
    customerPointDemands,
    preserveJunctionDemands,
    customAttributes,
  },
) =>
  changeSet(hydraulicModel, "replaceCustomerPoints", [
    putCustomerPoints(customerPoints),
    dropCustomerPoints(idsToDrop(hydraulicModel, customerPoints)),
    setDemands(
      planDemands(
        hydraulicModel,
        customerPointDemands,
        preserveJunctionDemands,
      ),
    ),
    ...(customAttributes ? [replaceCustomAttributes(customAttributes)] : []),
  ]);

const idsToDrop = (
  hydraulicModel: HydraulicModel,
  customerPoints: readonly CustomerPoint[],
): CustomerPointId[] => {
  const kept = new Set(customerPoints.map(({ id }) => id));
  return [...hydraulicModel.customerPoints.keys()].filter(
    (id) => !kept.has(id),
  );
};

const planDemands = (
  { demands }: HydraulicModel,
  customerPointDemands: ReadonlyMap<CustomerPointId, Demand[]>,
  preserveJunctionDemands: boolean,
): DemandAssignment[] => {
  const assignments: DemandAssignment[] = [];

  for (const [customerPointId, next] of customerPointDemands) {
    assignments.push({ customerPointId, demands: next });
  }

  for (const customerPointId of demands.customerPoints.keys()) {
    if (customerPointDemands.has(customerPointId)) continue;
    assignments.push({ customerPointId, demands: [] });
  }

  if (!preserveJunctionDemands) {
    for (const junctionId of demands.junctions.keys()) {
      assignments.push({ junctionId, demands: [] });
    }
  }

  return assignments;
};
