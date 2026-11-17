import type { Locale } from "@epanet-js/i18n/locale";
import type { ScriptingDocsVariant } from "src/lib/script-language";

export type ScriptAssistantScope =
  | "script"
  | "scriptAndOutput"
  | "anonymizedNetwork"
  | "fullNetwork";

export type ScriptAssistantRequest = {
  prompt: string;
  source: string;
  scope: ScriptAssistantScope;
  docsVariant: ScriptingDocsVariant;
  locale: Locale;
};

export type WrittenScript = { source: string; name: string | null };

export type ScriptSyntaxError = {
  message: string;
  line: number;
  column: number;
};

export type ScriptAssistantFailure =
  | "signedOut"
  | "notEnabled"
  | "limitReached"
  | "tooLong"
  | "answerTooLong"
  | "unavailable";

export type ScriptAssistantResult =
  | {
      status: "written";
      script: WrittenScript;
      syntaxError: ScriptSyntaxError | null;
      repaired: boolean;
    }
  | {
      status: "failed";
      reason: ScriptAssistantFailure;
      detail: string;
      httpStatus: number;
    };

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
