import { getWorker, dbPoolExists } from "@epanet-js/ejsdb";
import { getAppId } from "src/infra/app-instance";
import { writeQueue } from "src/lib/persistence/write-queue";

// A snapshot of everything that distinguishes the ways OPFS-backed storage can die. Sent
// with a db write failure, where the error alone ("disk I/O error") names a symptom common
// to a revoked access handle, an evicted origin, a full disk and a deleted backing file.
//
// What each field is here to answer:
// - `writesSucceeded` — did this db ever work? 0 means it was broken from the start.
// - `poolDirExists`   — is the pool still on disk, or did something delete it underneath us?
// - `storagePersisted`— is the origin evictable? The app never calls `storage.persist()`,
//                       so this is expected to be false, and eviction is then a legitimate
//                       explanation for a db that worked and then stopped.
// - `quotaBytes` / `usageBytes` — full disk, or nowhere near it.
// - `extendedErrcode` — which file operation actually failed (see the worker).
// - `poolPaused` / `poolCapacity` / `poolFileCount` — pool state, to rule out capacity
//                       exhaustion and to see whether the VFS is sitting paused.
export type DbDiagnostics = {
  appId: string;
  writesSucceeded: number;
  poolDirExists: boolean | null;
  storagePersisted: boolean | null;
  quotaBytes: number | null;
  usageBytes: number | null;
  worker: Record<string, unknown> | null;
};

const attempt = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch {
    return null;
  }
};

export const collectDbDiagnostics = async (): Promise<DbDiagnostics> => {
  const appId = getAppId();

  const estimate = await attempt(async () => {
    if (!navigator.storage?.estimate) return null;
    return await navigator.storage.estimate();
  });

  return {
    appId,
    writesSucceeded: writeQueue.succeededCount(),
    poolDirExists: await attempt(() => dbPoolExists(appId)),
    storagePersisted: await attempt(async () => {
      if (!navigator.storage?.persisted) return null;
      return await navigator.storage.persisted();
    }),
    quotaBytes: estimate?.quota ?? null,
    usageBytes: estimate?.usage ?? null,
    worker: await attempt(
      async () =>
        (await getWorker().storageDiagnostics()) as unknown as Record<
          string,
          unknown
        >,
    ),
  };
};
