const RECOVERY_KEY = "epanet-recovery";

export type RecoveryFingerprint = {
  poolId: string;
  projectName: string | null;
  timestamp: number;
};

export const writeRecoveryFingerprint = (
  fingerprint: RecoveryFingerprint,
): void => {
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(fingerprint));
  } catch {}
};

export const readRecoveryFingerprint = (): RecoveryFingerprint | null => {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecoveryFingerprint;
    if (!parsed || typeof parsed.poolId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearRecoveryFingerprint = (): void => {
  try {
    localStorage.removeItem(RECOVERY_KEY);
  } catch {}
};
