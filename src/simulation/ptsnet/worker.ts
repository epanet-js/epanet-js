import {
  PtsnetSimulation,
  serializeResults,
  type SerializedResults,
} from "@epanet-js/ptsnet";

export type PtsnetWorkerInput = {
  /** EPANET .inp contents. Node/link labels are the stringified asset ids. */
  inp: string;
  /** ptsnet valve name = String(valveAssetId). */
  valveName: string;
  settings: {
    duration: number;
    timeStep: number;
    defaultWaveSpeed: number;
  };
  operation: {
    finalSetting: number;
    startTime: number;
    endTime: number;
  };
};

export type PtsnetWorkerProgress = { fraction: number };
export type PtsnetProgressCallback = (progress: PtsnetWorkerProgress) => void;

export type PtsnetWorkerResult = {
  /** JSON-safe head/flow series + recorded timestamps. */
  serialized: SerializedResults;
  /** Steady-state node order (labels = stringified asset ids). */
  nodeLabels: string[];
  /** Node elevation [m], aligned to nodeLabels (for pressure = head - elevation). */
  nodeElevation: number[];
  /** Node type (0 junction, 1 reservoir, 2 tank), aligned to nodeLabels. */
  nodeType: number[];
};

/**
 * Runs a single valve-closure transient with ptsnet. `parallel.workers: 1`
 * keeps the engine inline (no nested worker spawn), so this is safe to call
 * from inside our own web worker. Requires the page to be cross-origin isolated.
 */
export async function runPtsnet(
  input: PtsnetWorkerInput,
  onProgress?: PtsnetProgressCallback,
): Promise<PtsnetWorkerResult> {
  const sim = await PtsnetSimulation.create({
    inp: input.inp,
    settings: {
      duration: input.settings.duration,
      timeStep: input.settings.timeStep,
      defaultWaveSpeed: input.settings.defaultWaveSpeed,
      waveSpeedMethod: "optimal",
      skipCompatibilityCheck: true,
    },
    recording: { nodes: "all", pipes: "all" },
    parallel: { workers: 1 },
    cavitation: false,
  });

  sim.defineValveOperation(input.valveName, {
    initialSetting: 1,
    finalSetting: input.operation.finalSetting,
    startTime: input.operation.startTime,
    endTime: input.operation.endTime,
    valveType: "butterfly",
    function: "linear",
  });

  await sim.runAsync({
    onProgress: (p) => onProgress?.({ fraction: p.fraction }),
  });

  const ss = sim.ss;
  const result: PtsnetWorkerResult = {
    serialized: serializeResults(sim.results, sim.time),
    nodeLabels: ss.node.labels,
    nodeElevation: Array.from(ss.node.elevation),
    nodeType: Array.from(ss.node.type),
  };

  sim.dispose();
  return result;
}
