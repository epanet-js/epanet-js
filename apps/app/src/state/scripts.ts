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
  outcome: ScriptRunOutcome | null;
  startedAt: number;
  finishedAt: number | null;
  cancel: () => void;
};

export const scriptRunAtom = atom<ScriptRunState | null>(null);

export type ScriptDraft = { name: string; source: string };

export const scriptDraftAtom = atom<ScriptDraft | null>(null);
