import { atom } from "jotai";
import type { RecoveryFingerprint } from "src/infra/session-recovery";

export const sessionRecoveryActiveAtom = atom(false);

export const recoverableSessionsAtom = atom<RecoveryFingerprint[]>([]);

export const recoverableSessionAtom = atom<RecoveryFingerprint | null>(
  (get) => {
    const sessions = get(recoverableSessionsAtom);
    if (sessions.length === 0) return null;
    return sessions.reduce((latest, session) =>
      session.timestampLastModelChange > latest.timestampLastModelChange
        ? session
        : latest,
    );
  },
);
