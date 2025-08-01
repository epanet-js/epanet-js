import { HydraulicModel } from "../../hydraulic-model";
import { CustomerPoint, CustomerPoints } from "../../customer-points";
import { AllocationRule } from "./allocate-customer-points";
import { prepareWorkerData } from "./prepare-worker-data";
import { runAllocation } from "./worker";

type InputData = {
  allocationRules: AllocationRule[];
  customerPoints: CustomerPoints;
};

export type AllocationResult = {
  allocatedCustomerPoints: CustomerPoints;
  ruleMatches: number[];
};

export const allocateCustomerPointsInWorker = (
  hydraulicModel: HydraulicModel,
  { allocationRules, customerPoints }: InputData,
): AllocationResult => {
  const ruleMatches = allocationRules.map(() => 0);
  const allocatedCustomerPoints = new Map<string, CustomerPoint>();

  const workerData = prepareWorkerData(
    hydraulicModel,
    allocationRules,
    Array.from(customerPoints.values()),
  );

  const allocationResults = runAllocation(workerData, allocationRules, 0);
  for (const result of allocationResults) {
    if (result.ruleIndex !== -1 && result.connection) {
      const customerPointCopy = customerPoints
        .get(result.customerPointId)
        ?.copy();
      if (customerPointCopy) {
        customerPointCopy.connect(result.connection);
        allocatedCustomerPoints.set(result.customerPointId, customerPointCopy);
        ruleMatches[result.ruleIndex]++;
      }
    }
  }

  return {
    allocatedCustomerPoints,
    ruleMatches,
  };
};
