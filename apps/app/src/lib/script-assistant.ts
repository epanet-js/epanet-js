import type { ScriptingDocsVariant } from "src/lib/script-language";

export type ScriptAssistantScope =
  | "script"
  | "scriptAndOutput"
  | "anonymizedNetwork"
  | "network";

export type ScriptAssistantRequest = {
  prompt: string;
  source: string;
  scope: ScriptAssistantScope;
  docsVariant: ScriptingDocsVariant;
};

export type WrittenScript = { source: string; name: string };

export type ScriptAssistantFailure =
  | "signedOut"
  | "notEnabled"
  | "limitReached"
  | "tooLong"
  | "unavailable";

export type ScriptAssistantResult =
  | { status: "written"; script: WrittenScript }
  | { status: "failed"; reason: ScriptAssistantFailure; detail: string };

export type ScriptAssistant = {
  writeScript: (
    request: ScriptAssistantRequest,
    options: { signal: AbortSignal; token: string | null },
  ) => Promise<ScriptAssistantResult>;
};

let assistant: ScriptAssistant | null = null;

export const registerScriptAssistant = (implementation: ScriptAssistant) => {
  assistant = implementation;
};

export const getScriptAssistant = (): ScriptAssistant | null => assistant;
