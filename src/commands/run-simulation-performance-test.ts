import { useCallback, useContext } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { MapEngine } from "src/map/map-engine";
import { HydraulicModel, attachSimulation } from "src/hydraulic-model";
import {
  Data,
  SimulationFinished,
  SimulationState,
  dataAtom,
  simulationAtom,
} from "src/state/jotai";
import { EPSResultsReader } from "src/simulation";
import { OPFSStorage } from "src/infra/storage";
import { MapContext } from "src/map/map-context";
import { getAppId } from "src/infra/app-instance";

const LOG_PREFIX = "[PERF-TEST]";

type PerformanceResult = {
  timestepIndex: number;
  dataTimeMs: number;
  renderTimeMs: number;
  totalTimeMs: number;
};

/**
 * Runs a performance test that loads each simulation timestep sequentially,
 * waits for the map to become idle after each step, and measures timing.
 *
 * Results are logged to the console at the end.
 */
export async function runSimulationPerformanceTest(
  hydraulicModel: HydraulicModel,
  mapEngine: MapEngine,
  setData: (updater: (prev: Data) => Data) => void,
  setSimulationState: (
    updater: (prev: SimulationState) => SimulationState,
  ) => void,
  simulationState: SimulationFinished,
  appId: string,
): Promise<void> {
  const results: PerformanceResult[] = [];

  const { metadata, simulationIds } = simulationState;

  if (!metadata || !simulationIds) {
    return;
  }

  const storage = new OPFSStorage(appId);
  const epsReader = new EPSResultsReader(storage);

  await epsReader.initialize(metadata, simulationIds);

  const timestepCount = epsReader.timestepCount;

  if (timestepCount === 0) {
    return;
  }

  let currentModel = hydraulicModel;

  for (let i = 0; i < timestepCount; i++) {
    const startTotal = performance.now();

    const startData = performance.now();
    const resultsReader = await epsReader.getResultsForTimestep(i);
    const updatedModel = attachSimulation(currentModel, resultsReader);
    currentModel = updatedModel;
    const dataTimeMs = performance.now() - startData;

    const startRender = performance.now();
    await mapEngine.waitForMapIdle(() => {
      setData((prev) => ({
        ...prev,
        hydraulicModel: updatedModel,
      }));
      setSimulationState((prev) => ({
        ...prev,
        currentTimestepIndex: i,
        modelVersion: updatedModel.version,
      }));
    }, updatedModel.assets.size);
    const renderTimeMs = performance.now() - startRender;

    const totalTimeMs = performance.now() - startTotal;

    results.push({
      timestepIndex: i,
      dataTimeMs,
      renderTimeMs,
      totalTimeMs,
    });
  }

  logPerformanceResults(results);
}

function logPerformanceResults(results: PerformanceResult[]): void {
  // eslint-disable-next-line no-console
  console.log(`\n${LOG_PREFIX} === Simulation Performance Test Results ===`);

  const totalSteps = results.length;

  // Data time stats (read from OPFS + attach to model)
  const dataTimes = results.map((r) => r.dataTimeMs);
  const avgDataTime = dataTimes.reduce((sum, t) => sum + t, 0) / totalSteps;
  const minDataTime = Math.min(...dataTimes);
  const maxDataTime = Math.max(...dataTimes);

  // Render time stats
  const renderTimes = results.map((r) => r.renderTimeMs);
  const avgRenderTime = renderTimes.reduce((sum, t) => sum + t, 0) / totalSteps;
  const minRenderTime = Math.min(...renderTimes);
  const maxRenderTime = Math.max(...renderTimes);

  // Total time stats
  const totalTimes = results.map((r) => r.totalTimeMs);
  const avgTotalTime = totalTimes.reduce((sum, t) => sum + t, 0) / totalSteps;
  const minTotalTime = Math.min(...totalTimes);
  const maxTotalTime = Math.max(...totalTimes);

  const totalDuration = totalTimes.reduce((sum, t) => sum + t, 0);

  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} Total steps: ${totalSteps}`);
  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} Data time (read+attach): avg=${avgDataTime.toFixed(1)}ms, min=${minDataTime.toFixed(1)}ms, max=${maxDataTime.toFixed(1)}ms`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} Render time:             avg=${avgRenderTime.toFixed(1)}ms, min=${minRenderTime.toFixed(1)}ms, max=${maxRenderTime.toFixed(1)}ms`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} Total time:              avg=${avgTotalTime.toFixed(1)}ms, min=${minTotalTime.toFixed(1)}ms, max=${maxTotalTime.toFixed(1)}ms`,
  );
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} Total duration: ${totalDuration.toFixed(0)}ms`);
}

export const useRunSimulationPerformanceTest = () => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const simulationState = useAtomValue(simulationAtom);
  const setData = useSetAtom(dataAtom);
  const setSimulationState = useSetAtom(simulationAtom);
  const mapEngine = useContext(MapContext);

  return useCallback(async () => {
    if (!mapEngine) {
      return;
    }

    if (
      simulationState.status === "idle" ||
      simulationState.status === "running"
    ) {
      return;
    }

    await runSimulationPerformanceTest(
      hydraulicModel,
      mapEngine,
      setData,
      setSimulationState,
      simulationState,
      getAppId(),
    );
  }, [hydraulicModel, mapEngine, setData, setSimulationState, simulationState]);
};
