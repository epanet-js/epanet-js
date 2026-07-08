const SAHPOOL_ROOT_DIR = "epanet-db";

export const sahpoolPoolName = (id: string): string =>
  `${SAHPOOL_ROOT_DIR}-${id}`;

export const sahpoolDirectory = (id: string): string =>
  `/${SAHPOOL_ROOT_DIR}/${id}`;

export const cleanupStaleDbPools = async (currentId: string): Promise<void> => {
  const isOpfsAvailable =
    navigator && navigator.storage.getDirectory !== undefined;

  if (!isOpfsAvailable) {
    return;
  }

  try {
    const root = await navigator.storage.getDirectory();
    const poolRoot = (await root.getDirectoryHandle(
      SAHPOOL_ROOT_DIR,
    )) as FileSystemDirectoryHandle & { keys(): AsyncIterableIterator<string> };

    const staleIds: string[] = [];
    for await (const id of poolRoot.keys()) {
      if (id !== currentId) staleIds.push(id);
    }

    for (const id of staleIds) {
      try {
        await poolRoot.removeEntry(id, { recursive: true });
      } catch {}
    }
  } catch {}
};
