const RECOVERY_KEY = "epanet-recovery";

export type RecoveryFingerprint = {
  poolId: string;
  projectName: string | null;
  timestampLastModelChange: number;
  timestampLastSave?: number;
};

type RecoveryStore = Record<string, RecoveryFingerprint>;

const isFingerprint = (value: unknown): value is RecoveryFingerprint =>
  !!value &&
  typeof value === "object" &&
  typeof (value as RecoveryFingerprint).poolId === "string";

const readStore = (): RecoveryStore => {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const store: RecoveryStore = {};
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (isFingerprint(value)) store[value.poolId] = value;
    }
    return store;
  } catch {
    return {};
  }
};

const writeStore = (store: RecoveryStore): void => {
  try {
    if (Object.keys(store).length === 0) {
      localStorage.removeItem(RECOVERY_KEY);
    } else {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(store));
    }
  } catch {}
};

export const writeRecoveryFingerprint = (
  fingerprint: RecoveryFingerprint,
): void => {
  const store = readStore();
  store[fingerprint.poolId] = fingerprint;
  writeStore(store);
};

export const readRecoveryFingerprints = (): RecoveryFingerprint[] =>
  Object.values(readStore());

export const clearRecoveryFingerprint = (poolId: string): void => {
  clearRecoveryFingerprints([poolId]);
};

export const clearRecoveryFingerprints = (poolIds: string[]): void => {
  if (poolIds.length === 0) return;
  const store = readStore();
  let changed = false;
  for (const poolId of poolIds) {
    if (poolId in store) {
      delete store[poolId];
      changed = true;
    }
  }
  if (changed) writeStore(store);
};
