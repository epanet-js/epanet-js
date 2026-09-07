import { HydraulicModel } from "../../hydraulic-model/hydraulic-model";
import {
  AssetId,
  CustomerPoint,
  CustomerPoints,
  CustomerPointAllocationResult,
  CustomerPointAllocationRule,
} from "@epanet-js/hydraulic-model";
import { prepareWorkerData, RunData } from "./prepare-data";
import { enrichWorkerError } from "src/infra/worker";
import { runAllocation } from "./run-allocation";
import { AllocationResultsView } from "./allocation-results";
import { getCustomerPointsWorker } from "./get-worker";
import type { Zone } from "src/lib/zones";

type AllocationOptions = {
  runOnWorker?: boolean;
  bufferType?: "shared" | "array";
  selectedPipes?: Set<AssetId>;
  selectedZone?: Zone;
};

type InputData = {
  allocationRules: CustomerPointAllocationRule[];
  customerPoints: CustomerPoints;
  options?: AllocationOptions;
};

export const allocateCustomerPoints = async (
  hydraulicModel: HydraulicModel,
  { allocationRules, customerPoints, options }: InputData,
): Promise<CustomerPointAllocationResult> => {
  const { runOnWorker = false, bufferType = "array" } = options ?? {};

  const ruleMatches = allocationRules.map(() => 0);
  const allocatedCustomerPoints = new Map<number, CustomerPoint>();
  const disconnectedCustomerPoints = new Map<number, CustomerPoint>();

  const workerData = prepareWorkerData(
    hydraulicModel,
    Array.from(customerPoints.values()),
    bufferType,
    options?.selectedZone?.geometry,
    options?.selectedPipes,
  );

  const totalCustomerPoints = customerPoints.size;

  if (totalCustomerPoints === 0) {
    return {
      allocatedCustomerPoints,
      disconnectedCustomerPoints,
      customerPointsMatchedToZone: 0,
      ruleMatches,
    };
  }

  const shouldUseWorkers = runOnWorker && hasWebWorker();
  const nullOffset = 0;

  const allocationResults = shouldUseWorkers
    ? await runAllocationWithSharedWorker(
        workerData,
        allocationRules,
        totalCustomerPoints,
      )
    : [runAllocation(workerData, allocationRules, nullOffset)];

  let customerPointsMatchedToZone = 0;

  for (const buffer of allocationResults) {
    for (const result of new AllocationResultsView(buffer).iter()) {
      if (result.inZone) customerPointsMatchedToZone++;

      const customerPointCopy = customerPoints
        .get(result.customerPointId)
        ?.copyDisconnected();
      if (!customerPointCopy) continue;

      if (result.connection) {
        customerPointCopy.connect(result.connection);
        allocatedCustomerPoints.set(result.customerPointId, customerPointCopy);
        ruleMatches[result.ruleIndex]++;
      } else {
        disconnectedCustomerPoints.set(
          result.customerPointId,
          customerPointCopy,
        );
      }
    }
  }

  return {
    allocatedCustomerPoints,
    disconnectedCustomerPoints,
    customerPointsMatchedToZone,
    ruleMatches,
  };
};

const runAllocationWithSharedWorker = async (
  workerData: RunData,
  allocationRules: CustomerPointAllocationRule[],
  totalCustomerPoints: number,
): Promise<ArrayBuffer[]> => {
  const workerAPI = getCustomerPointsWorker();

  try {
    const buffer = await workerAPI.runAllocation(
      workerData,
      allocationRules,
      0,
      totalCustomerPoints,
    );
    return [buffer];
  } catch (e) {
    throw enrichWorkerError("customer-allocation", e);
  }
};

const hasWebWorker = () => {
  try {
    return window.Worker !== undefined;
  } catch {
    return false;
  }
};
