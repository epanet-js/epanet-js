import { atom } from "jotai";
import type { RecoveryFingerprint } from "src/infra/session-recovery";

// Where the project DB lives. Independent of whether it currently works: a memory-mode DB
// in a browser without OPFS is healthy and in sync, it just cannot outlive the tab.
export type DbStorageMode = "opfs" | "memory";

export const dbStorageModeAtom = atom<DbStorageMode>("memory");

// Crash recovery needs a pool on disk to recover *from*, so it is exactly "are we on OPFS".
export const sessionRecoveryActiveAtom = atom(
  (get) => get(dbStorageModeAtom) === "opfs",
);

// Whether the DB can be used right now. Shared across every queued write, so one broken DB
// produces one response rather than one per edit. "unavailable" is terminal: the DB could
// not be rebuilt, so nothing can be persisted until the user loads a project again.
export type DbAvailabilityState =
  | "available"
  | "recovering"
  | "rebuilding"
  | "unavailable";

export const dbAvailabilityAtom = atom<DbAvailabilityState>("available");

export const MAX_REBUILD_ATTEMPTS = 1;

// Consecutive rebuilds: a write succeeding after one proves the db recovered, so the count
// starts again and only failures back-to-back are treated as unfixable.
export const rebuildAttemptsAtom = atom(0);

export const writesSucceededAtRebuildAtom = atom(0);

export const opfsReinstallFailedAtom = atom(false);

export const recoverableSessionsAtom = atom<RecoveryFingerprint[]>([]);
