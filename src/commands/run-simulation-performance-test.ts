import { MapEngine } from "src/map/map-engine";
import { HydraulicModel, attachSimulation } from "src/hydraulic-model";
import { Data, SimulationState } from "src/state/jotai";
import {
  readTimestepCountFromOPFS,
  readPrologMetadata,
  readTimestepFromOPFS,
  readTankVolumesFromOPFS,
  extractTimestepFromSlice,
  convertTimestepSliceToSimulationResults,
  EpanetResultsReader,
} from "src/simulation/epanet/main";
import {
  getOPFSFile,
  calculatePrologSize,
  calculateTimestepBlockSize,
} from "src/simulation/eps";

const LOG_PREFIX = "[PERF-TEST]";

type PerformanceResult = {
  timestepIndex: number;
  readTimeMs: number;
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
): Promise<void> {
  const results: PerformanceResult[] = [];

  // First check if OPFS file exists
  const opfsFile = await getOPFSFile();
  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} OPFS file check: ${opfsFile ? `exists, size=${opfsFile.size}` : "NOT FOUND"}`,
  );

  // Get timestep count from OPFS
  const timestepCount = await readTimestepCountFromOPFS();
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} Timestep count from epilog: ${timestepCount}`);
  if (timestepCount === null || timestepCount === 0) {
    // eslint-disable-next-line no-console
    console.log(`${LOG_PREFIX} No simulation timesteps found in OPFS`);
    return;
  }

  // Read prolog metadata once (use 1 as placeholder, we'll calculate actual count from file size)
  const metadata = await readPrologMetadata(1);
  if (!metadata) {
    // eslint-disable-next-line no-console
    console.error(`${LOG_PREFIX} Failed to read prolog metadata from OPFS`);
    return;
  }

  // Calculate actual timestep count from file size (reuse opfsFile from earlier check)
  if (!opfsFile) {
    // eslint-disable-next-line no-console
    console.error(`${LOG_PREFIX} Failed to get OPFS file`);
    return;
  }

  const fileSize = opfsFile.size;
  const prologSize = calculatePrologSize(metadata.prolog);
  const blockSize = calculateTimestepBlockSize(metadata.prolog);
  const epilogSize = 12;
  const dataSize = fileSize - prologSize - epilogSize;
  const actualTimestepCount = Math.floor(dataSize / blockSize);

  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} File size: ${fileSize} bytes`);
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} Prolog size: ${prologSize} bytes`);
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} Block size: ${blockSize} bytes`);
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} Epilog-reported timestep count: ${timestepCount}`);
  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} Calculated timestep count: ${actualTimestepCount}`,
  );

  if (actualTimestepCount <= 0) {
    // eslint-disable-next-line no-console
    console.error(`${LOG_PREFIX} No valid timesteps found in file`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} Starting performance test with ${actualTimestepCount} timesteps...`,
  );

  let currentModel = hydraulicModel;

  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} Metadata: nodeCount=${metadata.prolog.nodeCount}, linkCount=${metadata.prolog.linkCount}`,
  );

  for (let i = 0; i < actualTimestepCount; i++) {
    // eslint-disable-next-line no-console
    console.log(`${LOG_PREFIX} Processing timestep ${i}...`);
    const startTotal = performance.now();

    // Read timestep from OPFS
    const startRead = performance.now();
    const timestepData = await readTimestepFromOPFS(metadata, i);
    if (!timestepData) {
      // eslint-disable-next-line no-console
      console.error(`${LOG_PREFIX} Failed to read timestep ${i} from OPFS`);
      continue;
    }

    // eslint-disable-next-line no-console
    console.log(
      `${LOG_PREFIX} Timestep ${i}: slice size=${timestepData.byteLength}`,
    );

    // Read tank volumes for this timestep
    const tankVolumes = await readTankVolumesFromOPFS(
      metadata.tankIndices.length,
      i,
    );

    // Parse and convert timestep to SimulationResults
    const timestepResults = extractTimestepFromSlice(
      timestepData,
      metadata.prolog,
      i,
      metadata.nodeIds,
      metadata.linkIds,
    );
    const resultsData = convertTimestepSliceToSimulationResults(
      timestepResults,
      metadata,
      tankVolumes,
    );
    const resultsReader = new EpanetResultsReader(resultsData);
    const readTimeMs = performance.now() - startRead;

    // Attach simulation to model
    const updatedModel = attachSimulation(currentModel, resultsReader);
    currentModel = updatedModel;

    // Wait for map to render
    const startRender = performance.now();
    await mapEngine.waitForMapIdle(() => {
      setData((prev) => ({
        ...prev,
        hydraulicModel: updatedModel,
      }));
      setSimulationState((prev) => ({
        ...prev,
        stepIndex: i,
        modelVersion: updatedModel.version,
      }));
    }, updatedModel.assets.size);
    const renderTimeMs = performance.now() - startRender;

    const totalTimeMs = performance.now() - startTotal;

    results.push({ timestepIndex: i, readTimeMs, renderTimeMs, totalTimeMs });
  }

  // Log results to console
  logPerformanceResults(results);
}

function logPerformanceResults(results: PerformanceResult[]): void {
  // eslint-disable-next-line no-console
  console.log(`\n${LOG_PREFIX} === Simulation Performance Test Results ===`);

  for (const result of results) {
    // eslint-disable-next-line no-console
    console.log(
      `${LOG_PREFIX} Step ${result.timestepIndex}: read=${result.readTimeMs.toFixed(1)}ms, render=${result.renderTimeMs.toFixed(1)}ms, total=${result.totalTimeMs.toFixed(1)}ms`,
    );
  }

  const totalSteps = results.length;

  // Read time stats
  const readTimes = results.map((r) => r.readTimeMs);
  const avgReadTime = readTimes.reduce((sum, t) => sum + t, 0) / totalSteps;
  const minReadTime = Math.min(...readTimes);
  const maxReadTime = Math.max(...readTimes);

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
  console.log(`\n${LOG_PREFIX} === Summary ===`);
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} Total steps: ${totalSteps}`);
  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} Read time:   avg=${avgReadTime.toFixed(1)}ms, min=${minReadTime.toFixed(1)}ms, max=${maxReadTime.toFixed(1)}ms`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} Render time: avg=${avgRenderTime.toFixed(1)}ms, min=${minRenderTime.toFixed(1)}ms, max=${maxRenderTime.toFixed(1)}ms`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `${LOG_PREFIX} Total time:  avg=${avgTotalTime.toFixed(1)}ms, min=${minTotalTime.toFixed(1)}ms, max=${maxTotalTime.toFixed(1)}ms`,
  );
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} Total duration: ${totalDuration.toFixed(0)}ms`);
}
