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
  simulationsCandidate: {
    variant: "simulationsCandidate",
    apiPath: "/scripting-api-simulations-candidate",
    llmsPath: "/llms-simulations-candidate.txt",
  },
};

export const useScriptingDocs = (): ScriptingDocsLinks => {
  const isScriptingSimulationsOn = useFeatureFlag("FLAG_SCRIPTING_SIMULATIONS");
  return LINKS[isScriptingSimulationsOn ? "simulationsCandidate" : "official"];
};
