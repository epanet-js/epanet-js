import type { ScriptingDocsVariant } from "src/lib/script-language";

export type ScriptingDocsLinks = {
  variant: ScriptingDocsVariant;
  apiPath: string;
  llmsPath: string;
};

const LINKS: ScriptingDocsLinks = {
  variant: "official",
  apiPath: "/scripting-api",
  llmsPath: "/llms.txt",
};

export const useScriptingDocs = (): ScriptingDocsLinks => LINKS;
