import * as Comlink from "comlink";
import type { CustomerPointAllocationRule } from "@epanet-js/hydraulic-model";
import { runAllocation } from "./run-allocation";
import type { RunData } from "./run-data";

export interface AllocationWorkerAPI {
  runAllocation: (
    workerData: RunData,
    allocationRules: CustomerPointAllocationRule[],
    offset?: number,
    count?: number,
  ) => ArrayBuffer;
}

const workerAPI: AllocationWorkerAPI = {
  runAllocation: (workerData, allocationRules, offset, count) => {
    const results = runAllocation(workerData, allocationRules, offset, count);
    return Comlink.transfer(results, [results]);
  },
};

Comlink.expose(workerAPI);
