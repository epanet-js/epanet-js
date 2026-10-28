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
  resultsCandidate: {
    variant: "resultsCandidate",
    apiPath: "/scripting-api-results-candidate",
    llmsPath: "/llms-results-candidate.txt",
  },
};

export const useScriptingDocs = (): ScriptingDocsLinks => {
  const isScriptResultsOn = useFeatureFlag("FLAG_SCRIPT_RESULTS");
  return LINKS[isScriptResultsOn ? "resultsCandidate" : "official"];
};
