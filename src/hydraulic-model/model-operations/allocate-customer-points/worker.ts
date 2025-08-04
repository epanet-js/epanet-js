import * as Comlink from "comlink";
import { runAllocation, AllocationResultItem } from "./run-allocation";
import { RunData } from "./prepare-data";
import { AllocationRule } from "./types";

export interface AllocationWorkerAPI {
  runAllocation: (
    workerData: RunData,
    allocationRules: AllocationRule[],
    offset?: number,
    count?: number,
  ) => AllocationResultItem[];
}

const workerAPI: AllocationWorkerAPI = {
  runAllocation,
};

Comlink.expose(workerAPI);
