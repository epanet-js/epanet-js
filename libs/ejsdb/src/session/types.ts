export type HistoryCapture =
  | { kind: "edit"; seq: number; stateId: string; note: string }
  | { kind: "replay"; seq: number };

export type SessionHistoryEntry = {
  seq: number;
  stateId: string;
  note: string;
  byteSize: number;
  createdAt: number;
  hasChangeset: boolean;
};

export type SessionHistoryFailure = {
  stage: "init" | "capture";
  name: string;
  message: string;
};

export type SessionHistoryDiagnostics = {
  enabled: boolean;
  failure: SessionHistoryFailure | null;
  attached: boolean;
  appVersion: number;
  sessionVersion: number;
  metaAppVersion: number | null;
  pointer: number;
  entryCount: number;
  oldestSeq: number | null;
  totalBytes: number;
  droppedCount: number;
  dbBytes: number;
  entries: SessionHistoryEntry[];
};

export const emptySessionHistoryDiagnostics = (
  appVersion: number,
  sessionVersion: number,
  enabled = false,
  failure: SessionHistoryFailure | null = null,
): SessionHistoryDiagnostics => ({
  enabled,
  failure,
  attached: false,
  appVersion,
  sessionVersion,
  metaAppVersion: null,
  pointer: -1,
  entryCount: 0,
  oldestSeq: null,
  totalBytes: 0,
  droppedCount: 0,
  dbBytes: 0,
  entries: [],
});
