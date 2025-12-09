/**
 * EPS simulation storage using OPFS for binary data.
 *
 * Binary output files are stored in OPFS for efficient partial reading.
 */

const OPFS_SIMULATIONS_DIR = "simulations";

/**
 * Size of the EPANET binary epilog section.
 * Contains: averageIterations (4 bytes), warningFlag (4 bytes), reportingPeriods (4 bytes)
 */
const EPILOG_SIZE = 12;

/**
 * Gets the OPFS directory for simulations, creating it if needed.
 */
async function getSimulationsDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_SIMULATIONS_DIR, { create: true });
}

/**
 * Writes binary data to OPFS for a simulation.
 */
export async function writeBinaryToOPFS(
  simulationId: string,
  binaryData: Uint8Array,
): Promise<void> {
  const dir = await getSimulationsDirectory();
  const fileHandle = await dir.getFileHandle(`${simulationId}.out`, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([binaryData as BlobPart]));
  await writable.close();
}

/**
 * Writes tank volumes binary data to OPFS.
 * Format: Float32 array organized by timestep first, then by tank index.
 * Each timestep contains one float per tank (in tank index order from binary prolog).
 */
export async function writeTankBinaryToOPFS(
  simulationId: string,
  tankData: Uint8Array,
): Promise<void> {
  const dir = await getSimulationsDirectory();
  const fileHandle = await dir.getFileHandle(`${simulationId}.tanks`, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([tankData as BlobPart]));
  await writable.close();
}

/**
 * Reads a slice of bytes from the tank binary file.
 */
export async function readTankBinarySlice(
  simulationId: string,
  start: number,
  end: number,
): Promise<Uint8Array | null> {
  try {
    const dir = await getSimulationsDirectory();
    const fileHandle = await dir.getFileHandle(`${simulationId}.tanks`);
    const file = await fileHandle.getFile();
    const slice = file.slice(start, end);
    const buffer = await slice.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
}

/**
 * Gets a File handle from OPFS for partial reading.
 */
export async function getOPFSFile(simulationId: string): Promise<File | null> {
  try {
    const dir = await getSimulationsDirectory();
    const fileHandle = await dir.getFileHandle(`${simulationId}.out`);
    return fileHandle.getFile();
  } catch {
    return null;
  }
}

/**
 * Reads a slice of bytes from an OPFS simulation file.
 */
export async function readBinarySlice(
  simulationId: string,
  start: number,
  end: number,
): Promise<Uint8Array | null> {
  const file = await getOPFSFile(simulationId);
  if (!file) return null;

  const slice = file.slice(start, end);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Reads the reporting periods (timestep count) from the binary epilog.
 * The epilog is the last 12 bytes of the file, with reportingPeriods at offset 8.
 */
export async function readTimestepCountFromOPFS(
  simulationId: string,
): Promise<number | null> {
  const file = await getOPFSFile(simulationId);
  if (!file) return null;

  const fileSize = file.size;
  if (fileSize < EPILOG_SIZE) return null;

  const epilogSlice = file.slice(fileSize - EPILOG_SIZE, fileSize);
  const buffer = await epilogSlice.arrayBuffer();
  const view = new DataView(buffer);

  // reportingPeriods is at offset 8 in the epilog (after avgIterations and warningFlag)
  return view.getInt32(8, true);
}

/**
 * Deletes binary files from OPFS for a simulation.
 */
export async function deleteSimulationFromOPFS(
  simulationId: string,
): Promise<void> {
  try {
    const dir = await getSimulationsDirectory();
    await dir.removeEntry(`${simulationId}.out`);
  } catch {
    // File may not exist, ignore
  }
  try {
    const dir = await getSimulationsDirectory();
    await dir.removeEntry(`${simulationId}.tanks`);
  } catch {
    // File may not exist, ignore
  }
}

/**
 * Clears all simulation files from OPFS.
 */
export async function clearAllSimulationsFromOPFS(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(OPFS_SIMULATIONS_DIR, { recursive: true });
  } catch {
    // Directory may not exist, ignore
  }
}
