import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type { ScriptingDocsVariant } from "src/lib/script-language";

export type ScriptingDocsLinks = {
  variant: ScriptingDocsVariant;
  apiPath: string;
  llmsPath: string;
};

const LINKS: Record<ScriptingDocsVariant, ScriptingDocsLinks> = {
  official: {
    variant: "official",
    apiPath: "/scripting-api",
    llmsPath: "/llms.txt",
  },
  editsCandidate: {
    variant: "editsCandidate",
    apiPath: "/scripting-api-edits-candidate",
    llmsPath: "/llms-edits-candidate.txt",
  },
};

export const useScriptingDocs = (): ScriptingDocsLinks => {
  const isScriptEditsOn = useFeatureFlag("FLAG_SCRIPT_EDITS");
  return LINKS[isScriptEditsOn ? "editsCandidate" : "official"];
};
