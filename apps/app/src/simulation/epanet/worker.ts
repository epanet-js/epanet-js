import {
  runSimulation as runEngineSimulation,
  type EngineProgressCallback,
  type EPSSimulationResult,
} from "@epanet-js/simulation/engine";
import { OPFSStorage } from "src/infra/storage";

export {
  RESULTS_OUT_KEY,
  TANK_VOLUMES_KEY,
  PUMP_STATUS_KEY,
  NODE_STATS_KEY,
} from "@epanet-js/simulation";
export {
  warmupSimulationEngine,
  resetSimulationWorkerForTest,
  type EPSSimulationResult,
  type SimulationProgress,
  type ProgressCallback,
} from "@epanet-js/simulation/engine";

export const runSimulation = (
  inp: string,
  appId: string,
  onProgress: EngineProgressCallback,
  flags: Record<string, boolean> = {},
  scenarioKey?: string,
  runId?: string,
): Promise<EPSSimulationResult> =>
  runEngineSimulation(inp, {
    store: new OPFSStorage(appId, scenarioKey, runId),
    onProgress,
    flags,
  });
