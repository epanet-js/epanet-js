import * as Comlink from "comlink";
import { HydraulicModel } from "../../hydraulic-model/hydraulic-model";
import {
  CustomerPoint,
  CustomerPoints,
  CustomerPointAllocationResult,
  CustomerPointAllocationRule,
} from "@epanet-js/hydraulic-model";
import { prepareWorkerData, RunData } from "./prepare-data";
import { enrichWorkerError } from "src/infra/worker";
import { runAllocation, AllocationResultItem } from "./run-allocation";
import type { AllocationWorkerAPI } from "./worker";

type InputData = {
  allocationRules: CustomerPointAllocationRule[];
  customerPoints: CustomerPoints;
  targetPipes?: Set<number>;
  bufferType?: "shared" | "array";
};

const WORKER_COUNT = 10;

export const allocateCustomerPoints = async (
  hydraulicModel: HydraulicModel,
  {
    allocationRules,
    customerPoints,
    targetPipes,
    bufferType = "array",
  }: InputData,
): Promise<CustomerPointAllocationResult> => {
  const ruleMatches = allocationRules.map(() => 0);
  const allocatedCustomerPoints = new Map<number, CustomerPoint>();
  const disconnectedCustomerPoints = new Map<number, CustomerPoint>();

  const workerData = prepareWorkerData(
    hydraulicModel,
    Array.from(customerPoints.values()),
    bufferType,
    targetPipes,
  );

  const totalCustomerPoints = customerPoints.size;

  if (totalCustomerPoints === 0) {
    return {
      allocatedCustomerPoints,
      disconnectedCustomerPoints,
      ruleMatches,
    };
  }

  const shouldUseWorkers = hasWebWorker() && bufferType === "shared";

  const allocationResults = shouldUseWorkers
    ? await runAllocationWithWorkers(
        workerData,
        allocationRules,
        totalCustomerPoints,
      )
    : runAllocation(workerData, allocationRules, 0);

  for (const result of allocationResults) {
    const customerPointCopy = customerPoints
      .get(result.customerPointId)
      ?.copyDisconnected();
    if (customerPointCopy) {
      if (result.ruleIndex !== -1 && result.connection) {
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
    ruleMatches,
  };
};

const runAllocationWithWorkers = async (
  workerData: RunData,
  allocationRules: CustomerPointAllocationRule[],
  totalCustomerPoints: number,
): Promise<AllocationResultItem[]> => {
  const pointsPerWorker = Math.ceil(totalCustomerPoints / WORKER_COUNT);
  const workers: Worker[] = [];
  const workerAPIs: Comlink.Remote<AllocationWorkerAPI>[] = [];

  try {
    for (let i = 0; i < WORKER_COUNT; i++) {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      workers.push(worker);
      workerAPIs.push(Comlink.wrap<AllocationWorkerAPI>(worker));
    }

    const workerPromises = workerAPIs.map((workerAPI, workerIndex) => {
      const offset = workerIndex * pointsPerWorker;
      const count = Math.min(pointsPerWorker, totalCustomerPoints - offset);

      if (count <= 0) {
        return Promise.resolve([]);
      }

      return workerAPI.runAllocation(
        workerData,
        allocationRules,
        offset,
        count,
      );
    });

    const workerResults = await Promise.all(workerPromises);

    return workerResults.flat();
  } catch (e) {
    throw enrichWorkerError("customer-allocation", e);
  } finally {
    workers.forEach((worker) => {
      worker.terminate();
    });
  }
};

const hasWebWorker = () => {
  try {
    return window.Worker !== undefined;
  } catch {
    return false;
  }
};
