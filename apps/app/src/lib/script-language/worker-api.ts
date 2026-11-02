import {
  createScriptLanguageService,
  docsOf,
  type ScriptCompletion,
  type ScriptCompletionDetails,
  type ScriptLanguageService,
  type ScriptingDocsVariant,
} from "./language-service";

const services = new Map<ScriptingDocsVariant, ScriptLanguageService>();

const getService = (variant: ScriptingDocsVariant): ScriptLanguageService => {
  const existing = services.get(variant);
  if (existing) return existing;
  const service = createScriptLanguageService(docsOf[variant]);
  services.set(variant, service);
  return service;
};

export const workerAPI = {
  completionsAt: (
    variant: ScriptingDocsVariant,
    source: string,
    position: number,
  ): ScriptCompletion[] => getService(variant).completionsAt(source, position),
  completionDetails: (
    variant: ScriptingDocsVariant,
    source: string,
    position: number,
    name: string,
  ): ScriptCompletionDetails | null =>
    getService(variant).completionDetails(source, position, name),
};

export type ScriptLanguageWorkerAPI = typeof workerAPI;
