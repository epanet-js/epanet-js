import * as Comlink from "comlink";
import { CustomerPointAllocationRule } from "@epanet-js/hydraulic-model";
import { runAllocation, AllocationResultItem } from "./run-allocation";
import { RunData } from "./prepare-data";

export interface AllocationWorkerAPI {
  runAllocation: (
    workerData: RunData,
    allocationRules: CustomerPointAllocationRule[],
    offset?: number,
    count?: number,
  ) => AllocationResultItem[];
}

const workerAPI: AllocationWorkerAPI = {
  runAllocation,
};

Comlink.expose(workerAPI);
