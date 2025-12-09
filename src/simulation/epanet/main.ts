import * as Comlink from "comlink";
import { lib as webWorker } from "src/lib/worker";
import { SimulationResult } from "../result";
import { EpanetResultsReader } from "./epanet-results";
import {
  initOPFS,
  readBinarySlice,
  readTankBinarySlice,
  readTimestepCountFromOPFS,
} from "../eps/eps-store";
import { getAppId } from "src/appInstance";
import {
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
  buildNodeTypes,
  PROLOG_HEADER_SIZE,
  type PartialReadMetadata,
} from "../eps";
import type { ProgressCallback, SimulationProgress } from "./worker";

export type { SimulationProgress };

/**
 * Reads prolog metadata from OPFS using partial reads.
 * First reads the header to get counts, then reads the full prolog section.
 */
async function readPrologMetadata(
  timestepCount: number,
): Promise<PartialReadMetadata | null> {
  // Read prolog header (first 884 bytes) to get counts
  const headerData = await readBinarySlice(0, PROLOG_HEADER_SIZE);
  if (!headerData) return null;

  const prolog = parsePrologHeader(headerData, timestepCount);

  // Calculate full prolog size and read it
  const prologSize = calculatePrologSize(prolog);
  const prologData = await readBinarySlice(0, prologSize);
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
    tankIndices,
  };
}

/**
 * Reads tank volumes for a specific timestep from the tank binary file.
 * @returns Float32Array of tank volumes in tank index order, or undefined if no tanks
 */
async function readTankVolumesFromOPFS(
  tankCount: number,
  timestepIndex: number,
): Promise<Float32Array | undefined> {
  if (tankCount === 0) return undefined;

  const bytesPerFloat = 4;
  const start = timestepIndex * tankCount * bytesPerFloat;
  const end = start + tankCount * bytesPerFloat;

  const data = await readTankBinarySlice(start, end);
  if (!data) return undefined;

  // Copy to a new ArrayBuffer to ensure proper alignment for Float32Array
  const alignedBuffer = new ArrayBuffer(data.length);
  new Uint8Array(alignedBuffer).set(data);
  return new Float32Array(alignedBuffer);
}

/**
 * Reads a single timestep from OPFS using partial reads.
 */
async function readTimestepFromOPFS(
  metadata: PartialReadMetadata,
  timestepIndex: number,
): Promise<Uint8Array | null> {
  const baseOffset = calculateResultsBaseOffset(metadata.prolog);
  const blockSize = calculateTimestepBlockSize(metadata.prolog);
  const start = baseOffset + blockSize * timestepIndex;
  const end = start + blockSize;

  return readBinarySlice(start, end);
}

/**
 * Runs a hydraulic simulation and returns results.
 *
 * The worker stores binary results in OPFS, overwriting any previous results.
 * Only one simulation result is stored at a time to minimize storage usage.
 *
 * @param inp - The EPANET INP file content
 * @param flags - Optional flags for the simulation
 * @param onProgress - Optional callback for progress updates during simulation
 */
export const runSimulation = async (
  inp: string,
  flags: Record<string, boolean> = {},
  onProgress?: ProgressCallback,
): Promise<SimulationResult> => {
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

  // Initialize OPFS with app ID (workers can't access sessionStorage)
  const appId = getAppId();
  initOPFS(appId);

  const { status, report } = await webWorker.runSimulation(
    inp,
    appId,
    flags,
    progressProxy,
  );

  // If simulation failed, return empty results
  if (status === "failure") {
    return {
      status,
      report,
      results: new EpanetResultsReader(new Map()),
    };
  }

  // Read timestep count from binary epilog
  const timestepCount = await readTimestepCountFromOPFS();
  if (timestepCount === null || timestepCount === 0) {
    return {
      status,
      report,
      results: new EpanetResultsReader(new Map()),
    };
  }

  // Read prolog metadata using partial reads
  const prologMetadata = await readPrologMetadata(timestepCount);
  if (!prologMetadata) {
    throw new Error("Failed to read prolog metadata from OPFS");
  }

  // Read first timestep using partial reads
  const timestepData = await readTimestepFromOPFS(prologMetadata, 0);
  if (!timestepData) {
    throw new Error("Failed to read timestep data from OPFS");
  }

  // Read tank volumes for first timestep from tank binary file
  const tankVolumes = await readTankVolumesFromOPFS(
    prologMetadata.tankIndices.length,
    0,
  );

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
    tankVolumes,
  );
  const results = new EpanetResultsReader(resultsData);

  return { status, report, results };
};
