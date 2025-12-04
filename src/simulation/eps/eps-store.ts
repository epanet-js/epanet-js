/**
 * IndexedDB store for EPS simulation results.
 *
 * Stores the raw EPANET binary output file and metadata for each simulation.
 * Multiple simulations can be stored and retrieved by ID.
 */

const DB_NAME = "epanet-eps";
const DB_VERSION = 1;

const STORES = {
  SIMULATIONS: "simulations",
} as const;

export type EPSSimulationMetadata = {
  simulationId: string;
  createdAt: number;
  duration: number; // total simulation duration in seconds
  timestepCount: number;
  nodeCount: number;
  linkCount: number;
};

/**
 * Tank data captured during simulation (not available in binary format).
 * Map from tank ID to array of { level, volume } per timestep.
 */
export type TankTimestepData = {
  level: number;
  volume: number;
};

export type EPSSimulationRecord = {
  metadata: EPSSimulationMetadata;
  binaryData: Uint8Array;
  /** Tank level/volume per timestep, keyed by tank ID */
  tankData?: Map<string, TankTimestepData[]>;
};

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
 * Deletes an EPS simulation from IndexedDB.
 */
export async function deleteEPSSimulation(simulationId: string): Promise<void> {
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
 * Clears all EPS simulations from IndexedDB.
 */
export async function clearAllEPSSimulations(): Promise<void> {
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
