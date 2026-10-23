import { atom } from "jotai";
import type { ScriptConsoleLevel, ScriptRunOutcome } from "src/lib/scripting";

export type ScriptConsoleLine =
  | { type: "text"; level: ScriptConsoleLevel; text: string }
  | { type: "table"; columns: string[]; rows: string[][] };

export type ScriptRunState = {
  name: string;
  status: "running" | "finished";
  lines: ScriptConsoleLine[];
  progress: number | null;
  progressMessage: string | null;
  outcome: ScriptRunOutcome | null;
  startedAt: number;
  finishedAt: number | null;
  cancel: () => void;
};

export const scriptRunAtom = atom<ScriptRunState | null>(null);

export type UserScript = {
  id: string;
  name: string;
  source: string;
  apiVersion: number;
  updatedAt: number;
};

export const userScriptsAtom = atom<UserScript[]>([]);

export type ScriptDraft = {
  scriptId: string | null;
  exampleId: string | null;
  name: string;
  source: string;
  savedAs: { name: string; source: string } | null;
};

export const scriptDraftAtom = atom<ScriptDraft | null>(null);

export const hasUnsavedChanges = (draft: ScriptDraft): boolean =>
  draft.savedAs === null ||
  draft.name !== draft.savedAs.name ||
  draft.source !== draft.savedAs.source;
