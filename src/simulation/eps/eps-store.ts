/**
 * EPS simulation storage using OPFS for binary data and IndexedDB for metadata.
 *
 * Binary output files are stored in OPFS for efficient partial reading.
 * Metadata and tank data are stored in IndexedDB for quick access.
 */

const DB_NAME = "epanet-eps";
const DB_VERSION = 1;
const OPFS_SIMULATIONS_DIR = "simulations";

const STORES = {
  SIMULATIONS: "simulations",
} as const;

export type EPSSimulationMetadata = {
  simulationId: string;
  modelVersion: string;
  createdAt: number;
  duration: number; // total simulation duration in seconds
  timestepCount: number;
  nodeCount: number;
  linkCount: number;
};

/**
 * Tank data captured during simulation (not available in binary format).
 * Only volume is needed - level is available as node pressure in binary.
 */
export type TankTimestepData = {
  volume: number;
};

/**
 * Record stored in IndexedDB (metadata only, binary is in OPFS).
 */
export type EPSSimulationRecord = {
  metadata: EPSSimulationMetadata;
  /** Tank volume per timestep, keyed by tank ID */
  tankData?: Map<string, TankTimestepData[]>;
};

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
 * Deletes binary data from OPFS for a simulation.
 */
async function deleteBinaryFromOPFS(simulationId: string): Promise<void> {
  try {
    const dir = await getSimulationsDirectory();
    await dir.removeEntry(`${simulationId}.out`);
  } catch {
    // File may not exist, ignore
  }
}

/**
 * Clears all binary files from OPFS.
 */
async function clearAllBinaryFromOPFS(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(OPFS_SIMULATIONS_DIR, { recursive: true });
  } catch {
    // Directory may not exist, ignore
  }
}

/**
 * Opens the IndexedDB database, creating stores if needed.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create simulations store with simulationId as key
      if (!db.objectStoreNames.contains(STORES.SIMULATIONS)) {
        db.createObjectStore(STORES.SIMULATIONS, {
          keyPath: "metadata.simulationId",
        });
      }
    };
  });
}

/**
 * Saves an EPS simulation result to IndexedDB.
 */
export async function saveEPSSimulation(
  record: EPSSimulationRecord,
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SIMULATIONS, "readwrite");
    const store = transaction.objectStore(STORES.SIMULATIONS);

    const request = store.put(record);

    request.onerror = () => {
      reject(new Error(`Failed to save simulation: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Loads an EPS simulation result from IndexedDB.
 */
export async function loadEPSSimulation(
  simulationId: string,
): Promise<EPSSimulationRecord | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SIMULATIONS, "readonly");
    const store = transaction.objectStore(STORES.SIMULATIONS);

    const request = store.get(simulationId);

    request.onerror = () => {
      reject(new Error(`Failed to load simulation: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result ?? null);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Deletes an EPS simulation from IndexedDB and OPFS.
 */
export async function deleteEPSSimulation(simulationId: string): Promise<void> {
  // Delete from OPFS first
  await deleteBinaryFromOPFS(simulationId);

  // Delete from IndexedDB
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SIMULATIONS, "readwrite");
    const store = transaction.objectStore(STORES.SIMULATIONS);

    const request = store.delete(simulationId);

    request.onerror = () => {
      reject(
        new Error(`Failed to delete simulation: ${request.error?.message}`),
      );
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Lists all stored EPS simulations (metadata only).
 */
export async function listEPSSimulations(): Promise<EPSSimulationMetadata[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SIMULATIONS, "readonly");
    const store = transaction.objectStore(STORES.SIMULATIONS);

    const request = store.getAll();

    request.onerror = () => {
      reject(
        new Error(`Failed to list simulations: ${request.error?.message}`),
      );
    };

    request.onsuccess = () => {
      const records = request.result as EPSSimulationRecord[];
      resolve(records.map((r) => r.metadata));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Clears all EPS simulations from IndexedDB and OPFS.
 */
export async function clearAllEPSSimulations(): Promise<void> {
  // Clear all binaries from OPFS first
  await clearAllBinaryFromOPFS();

  // Clear IndexedDB
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SIMULATIONS, "readwrite");
    const store = transaction.objectStore(STORES.SIMULATIONS);

    const request = store.clear();

    request.onerror = () => {
      reject(
        new Error(`Failed to clear simulations: ${request.error?.message}`),
      );
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}
