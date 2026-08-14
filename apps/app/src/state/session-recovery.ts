import { atom } from "jotai";
import type { RecoveryFingerprint } from "src/infra/session-recovery";

export const sessionRecoveryActiveAtom = atom(false);

export const recoverableSessionsAtom = atom<RecoveryFingerprint[]>([]);
