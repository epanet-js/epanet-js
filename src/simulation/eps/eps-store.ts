/**
 * EPS simulation storage using OPFS for binary data.
 *
 * Binary output files are stored in OPFS for efficient partial reading.
 * Each browser tab gets its own subdirectory to prevent cross-tab interference.
 * Only one simulation result is stored at a time (results.out and results.tanks).
 */

// App ID for OPFS directory - must be set via initOPFS() before using other functions
let _appId: string | null = null;

/**
 * Initializes OPFS storage with the given app ID.
 * Must be called before any other OPFS functions.
 * Call this from both the main thread and workers with the same app ID.
 */
export function initOPFS(appId: string): void {
  if (_appId !== null && _appId !== appId) {
    throw new Error(
      `OPFS already initialized with a different app ID: ${_appId}`,
    );
  }
  _appId = appId;
}

function getAppIdOrThrow(): string {
  if (_appId === null) {
    throw new Error("OPFS not initialized. Call initOPFS(appId) first.");
  }
  return _appId;
}

const OPFS_SIMULATIONS_DIR = "simulations";
const HEARTBEAT_FILE = ".heartbeat";
const RESULTS_FILE = "results.out";
const TANKS_FILE = "results.tanks";
const STALE_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks

/**
 * Size of the EPANET binary epilog section.
 * Contains: averageIterations (4 bytes), warningFlag (4 bytes), reportingPeriods (4 bytes)
 */
const EPILOG_SIZE = 12;

/**
 * Gets the OPFS directory for all simulations, creating it if needed.
 */
async function getSimulationsDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_SIMULATIONS_DIR, { create: true });
}

/**
 * Gets the OPFS directory for this tab's simulations, creating it if needed.
 */
async function getTabDirectory(): Promise<FileSystemDirectoryHandle> {
  const simDir = await getSimulationsDirectory();
  return simDir.getDirectoryHandle(getAppIdOrThrow(), { create: true });
}

/**
 * Updates the heartbeat file for this tab with the current timestamp.
 * Call this periodically to indicate the tab is still active.
 */
export async function updateHeartbeat(): Promise<void> {
  try {
    const dir = await getTabDirectory();
    const file = await dir.getFileHandle(HEARTBEAT_FILE, { create: true });
    const writable = await file.createWritable();
    await writable.write(String(Date.now()));
    await writable.close();
  } catch {
    // Ignore errors - heartbeat is best-effort
  }
}

/**
 * Reads the heartbeat timestamp from a tab directory.
 */
async function readHeartbeat(
  tabDir: FileSystemDirectoryHandle,
): Promise<number | null> {
  try {
    const file = await tabDir.getFileHandle(HEARTBEAT_FILE);
    const content = await (await file.getFile()).text();
    return parseInt(content, 10);
  } catch {
    return null;
  }
}

/**
 * Cleans up stale tab directories that haven't been accessed recently.
 * Call this on app initialization.
 */
export async function cleanupStaleTabs(): Promise<void> {
  try {
    const simDir = await getSimulationsDirectory();
    const now = Date.now();

    for await (const [name, handle] of simDir.entries()) {
      // Skip non-directories and the current tab
      if (handle.kind !== "directory" || name === getAppIdOrThrow()) continue;

      const tabDir = handle;
      const lastAccess = await readHeartbeat(tabDir);

      // Delete if heartbeat is stale or missing (legacy directories)
      if (lastAccess === null || now - lastAccess > STALE_THRESHOLD_MS) {
        await simDir.removeEntry(name, { recursive: true });
      }
    }
  } catch {
    // Ignore errors - cleanup is best-effort
  }
}

/**
 * Reads a slice of bytes from the tank binary file.
 */
export async function readTankBinarySlice(
  start: number,
  end: number,
): Promise<Uint8Array | null> {
  try {
    const dir = await getTabDirectory();
    const fileHandle = await dir.getFileHandle(TANKS_FILE);
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
export async function getOPFSFile(): Promise<File | null> {
  try {
    const dir = await getTabDirectory();
    const fileHandle = await dir.getFileHandle(RESULTS_FILE);
    return fileHandle.getFile();
  } catch {
    return null;
  }
}

/**
 * Reads a slice of bytes from the OPFS simulation file.
 */
export async function readBinarySlice(
  start: number,
  end: number,
): Promise<Uint8Array | null> {
  const file = await getOPFSFile();
  if (!file) return null;

  const slice = file.slice(start, end);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Reads the reporting periods (timestep count) from the binary epilog.
 * The epilog is the last 12 bytes of the file, with reportingPeriods at offset 8.
 */
export async function readTimestepCountFromOPFS(): Promise<number | null> {
  const file = await getOPFSFile();
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
 * Clears all simulation files from OPFS for the current tab only.
 */
export async function clearAllSimulationsFromOPFS(): Promise<void> {
  try {
    const simDir = await getSimulationsDirectory();
    await simDir.removeEntry(getAppIdOrThrow(), { recursive: true });
  } catch {
    // Directory may not exist, ignore
  }
}

/**
 * Writes binary simulation results to OPFS.
 * Also updates the heartbeat to mark the tab as active.
 */
export async function writeBinaryToOPFS(binaryData: Uint8Array): Promise<void> {
  const dir = await getTabDirectory();
  const fileHandle = await dir.getFileHandle(RESULTS_FILE, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([binaryData as BlobPart]));
  await writable.close();

  // Update heartbeat when storing new results
  await updateHeartbeat();
}

/**
 * Writes tank volumes binary data to OPFS.
 */
export async function writeTankBinaryToOPFS(
  tankData: Uint8Array,
): Promise<void> {
  const dir = await getTabDirectory();
  const fileHandle = await dir.getFileHandle(TANKS_FILE, {
    create: true,
  });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([tankData as BlobPart]));
  await writable.close();
}
