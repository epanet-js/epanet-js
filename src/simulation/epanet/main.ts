import * as Comlink from "comlink";
import { lib as webWorker } from "src/lib/worker";
import { SimulationResult } from "../result";
import { EpanetResultsReader } from "./epanet-results";
import { loadEPSSimulation, readBinarySlice } from "../eps/eps-store";
import {
  BinaryNodeType,
  convertTimestepSliceToSimulationResults,
  parsePrologHeader,
  calculatePrologSize,
  calculateResultsBaseOffset,
  calculateTimestepBlockSize,
  extractTimestepFromSlice,
  extractNodeIds,
  extractLinkIds,
  extractLinkTypes,
  extractTankIndices,
  extractTankAreas,
  PROLOG_HEADER_SIZE,
  type PartialReadMetadata,
} from "../eps";
import type { ProgressCallback, SimulationProgress } from "./worker";

export type { SimulationProgress };

/**
 * Builds node types array from tank indices and areas.
 */
function buildNodeTypes(
  nodeCount: number,
  tankIndices: number[],
  tankAreas: number[],
): BinaryNodeType[] {
  const types: BinaryNodeType[] = new Array(nodeCount).fill(
    BinaryNodeType.Junction,
  );

  for (let i = 0; i < tankIndices.length; i++) {
    const nodeIndex = tankIndices[i];
    if (tankAreas[i] === 0) {
      types[nodeIndex] = BinaryNodeType.Reservoir;
    } else {
      types[nodeIndex] = BinaryNodeType.Tank;
    }
  }

  return types;
}

/**
 * Reads prolog metadata from OPFS using partial reads.
 * First reads the header to get counts, then reads the full prolog section.
 */
async function readPrologMetadata(
  simulationId: string,
  timestepCount: number,
): Promise<PartialReadMetadata | null> {
  // Read prolog header (first 884 bytes) to get counts
  const headerData = await readBinarySlice(simulationId, 0, PROLOG_HEADER_SIZE);
  if (!headerData) return null;

  const prolog = parsePrologHeader(headerData, timestepCount);

  // Calculate full prolog size and read it
  const prologSize = calculatePrologSize(prolog);
  const prologData = await readBinarySlice(simulationId, 0, prologSize);
  if (!prologData) return null;

  // Extract metadata from prolog
  const nodeIds = extractNodeIds(prologData, prolog);
  const linkIds = extractLinkIds(prologData, prolog);
  const linkTypes = extractLinkTypes(prologData, prolog);
  const tankIndices = extractTankIndices(prologData, prolog);
  const tankAreas = extractTankAreas(prologData, prolog);
  const nodeTypes = buildNodeTypes(prolog.nodeCount, tankIndices, tankAreas);

  return {
    prolog,
    nodeIds,
    linkIds,
    linkTypes,
    nodeTypes,
  };
}

/**
 * Reads a single timestep from OPFS using partial reads.
 */
async function readTimestepFromOPFS(
  simulationId: string,
  metadata: PartialReadMetadata,
  timestepIndex: number,
): Promise<Uint8Array | null> {
  const baseOffset = calculateResultsBaseOffset(metadata.prolog);
  const blockSize = calculateTimestepBlockSize(metadata.prolog);
  const start = baseOffset + blockSize * timestepIndex;
  const end = start + blockSize;

  return readBinarySlice(simulationId, start, end);
}

/**
 * Runs a hydraulic simulation and returns results.
 *
 * The worker stores binary results in OPFS and metadata in IndexedDB.
 * This function loads the results and converts the first timestep to SimulationResults.
 *
 * @param inp - The EPANET INP file content
 * @param modelVersion - The model version string
 * @param flags - Optional flags for the simulation
 * @param onProgress - Optional callback for progress updates during simulation
 */
export const runSimulation = async (
  inp: string,
  modelVersion: string,
  flags: Record<string, boolean> = {},
  onProgress?: ProgressCallback,
): Promise<SimulationResult> => {
  // Generate unique simulation ID
  const simulationId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Always log progress and forward to optional callback
  const wrappedProgress: ProgressCallback = (progress) => {
    const percent =
      progress.totalDuration > 0
        ? Math.round((progress.currentTime / progress.totalDuration) * 100)
        : null;
    // eslint-disable-next-line no-console
    console.log(
      `Simulation progress: ${progress.currentTime}s / ${progress.totalDuration}s${percent !== null ? ` (${percent}%)` : ""}`,
    );
    onProgress?.(progress);
  };
  const progressProxy = Comlink.proxy(wrappedProgress);

  const { report, status, metadata } = await webWorker.runSimulation(
    inp,
    simulationId,
    modelVersion,
    flags,
    progressProxy,
  );

  // If simulation failed, return empty results
  if (status === "failure" || metadata.timestepCount === 0) {
    return {
      status,
      report,
      results: new EpanetResultsReader(new Map()),
    };
  }

  // Load metadata from IndexedDB
  const record = await loadEPSSimulation(simulationId);
  if (!record) {
    throw new Error(`Failed to load simulation ${simulationId} from IndexedDB`);
  }

  // Read prolog metadata using partial reads
  const prologMetadata = await readPrologMetadata(
    simulationId,
    metadata.timestepCount,
  );
  if (!prologMetadata) {
    throw new Error(
      `Failed to read prolog metadata for simulation ${simulationId} from OPFS`,
    );
  }

  // Read first timestep using partial reads
  const timestepData = await readTimestepFromOPFS(
    simulationId,
    prologMetadata,
    0,
  );
  if (!timestepData) {
    throw new Error(
      `Failed to read timestep data for simulation ${simulationId} from OPFS`,
    );
  }

  // Parse and convert timestep to SimulationResults
  const timestepResults = extractTimestepFromSlice(
    timestepData,
    prologMetadata.prolog,
    0,
    prologMetadata.nodeIds,
    prologMetadata.linkIds,
  );
  const resultsData = convertTimestepSliceToSimulationResults(
    timestepResults,
    prologMetadata,
    record.tankData,
    0,
  );
  const results = new EpanetResultsReader(resultsData);

  return { status, report, results };
};
