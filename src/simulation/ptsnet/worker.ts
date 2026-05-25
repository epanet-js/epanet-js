import {
  PtsnetSimulation,
  serializeResults,
  type SerializedResults,
  type WaveSpeedMethod,
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
    waveSpeedMethod: WaveSpeedMethod;
    /** Worker-pool size for the MOC engine. 1 keeps it inline (no nested workers). */
    workers: number;
    /**
     * When false, the engine records nothing (no head/flow series), so there is
     * nothing to serialize or transfer back — used to time the solve on large
     * networks without paying the save cost. `serialized` comes back empty.
     */
    saveResults: boolean;
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
 * Runs a single valve-closure transient with ptsnet. The MOC engine spawns
 * `settings.workers` nested Web Workers (Blob + SharedArrayBuffer) from inside
 * our own worker; `workers: 1` keeps it inline (no nested spawn). Requires the
 * page to be cross-origin isolated.
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
      waveSpeedMethod: input.settings.waveSpeedMethod,
      skipCompatibilityCheck: true,
    },
    recording: input.settings.saveResults
      ? { nodes: "all", pipes: "all" }
      : { nodes: "none", pipes: "none" },
    parallel: { workers: input.settings.workers },
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
