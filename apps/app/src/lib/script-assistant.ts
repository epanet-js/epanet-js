export type ScriptAssistantScope =
  | "script"
  | "scriptAndOutput"
  | "anonymizedNetwork"
  | "network";

export type ScriptAssistantRequest = {
  prompt: string;
  source: string;
  scope: ScriptAssistantScope;
};

export type WrittenScript = { source: string; name: string };

export type ScriptAssistant = {
  writeScript: (
    request: ScriptAssistantRequest,
    options: { signal: AbortSignal; token: string | null },
  ) => Promise<WrittenScript>;
};

let assistant: ScriptAssistant | null = null;

export const registerScriptAssistant = (implementation: ScriptAssistant) => {
  assistant = implementation;
};

export const getScriptAssistant = (): ScriptAssistant | null => assistant;
