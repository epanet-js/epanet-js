import * as Comlink from "comlink";
import { runAllocation, AllocationResultItem } from "./worker";
import { WorkerSpatialData } from "./prepare-worker-data";
import { AllocationRule } from "./allocate-customer-points";

export interface AllocationWorkerAPI {
  runAllocation: (
    workerData: WorkerSpatialData,
    allocationRules: AllocationRule[],
    offset?: number,
    count?: number,
  ) => AllocationResultItem[];
}

const workerAPI: AllocationWorkerAPI = {
  runAllocation,
};

Comlink.expose(workerAPI);
