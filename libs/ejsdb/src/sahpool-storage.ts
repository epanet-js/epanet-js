const SAHPOOL_ROOT_DIR = "epanet-db";

export const sahpoolPoolName = (id: string): string =>
  `${SAHPOOL_ROOT_DIR}-${id}`;

export const sahpoolDirectory = (id: string): string =>
  `/${SAHPOOL_ROOT_DIR}/${id}`;

export const cleanupStaleDbPools = async (
  currentId: string,
  protectedIds: string[] = [],
  isPoolInUse?: (id: string) => Promise<boolean>,
): Promise<void> => {
  if (!isOpfsAvailable()) {
    return;
  }

  const keepIds = new Set([currentId, ...protectedIds]);

  try {
    const root = await navigator.storage.getDirectory();
    const poolRoot = (await root.getDirectoryHandle(
      SAHPOOL_ROOT_DIR,
    )) as FileSystemDirectoryHandle & { keys(): AsyncIterableIterator<string> };

    const staleIds: string[] = [];
    for await (const id of poolRoot.keys()) {
      if (!keepIds.has(id)) staleIds.push(id);
    }

    for (const id of staleIds) {
      try {
        if (isPoolInUse && (await isPoolInUse(id))) continue;
        await poolRoot.removeEntry(id, { recursive: true });
      } catch {}
    }
  } catch {}
};

export const dbPoolExists = async (id: string): Promise<boolean> => {
  if (!isOpfsAvailable()) {
    return false;
  }

  try {
    const root = await navigator.storage.getDirectory();
    const poolRoot = await root.getDirectoryHandle(SAHPOOL_ROOT_DIR);
    await poolRoot.getDirectoryHandle(id);
    return true;
  } catch {
    return false;
  }
};

const isOpfsAvailable = (): boolean =>
  typeof navigator !== "undefined" &&
  navigator.storage?.getDirectory !== undefined;
