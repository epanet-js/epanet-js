import {
  createScriptLanguageService,
  type ScriptLanguageService,
} from "./language-service";

export type ScriptLanguageWorkerAPI = ScriptLanguageService;

let service: ScriptLanguageService | null = null;

const getService = (): ScriptLanguageService => {
  if (!service) service = createScriptLanguageService();
  return service;
};

export const workerAPI: ScriptLanguageWorkerAPI = {
  completionsAt: (source, position) =>
    getService().completionsAt(source, position),
  completionDetails: (source, position, name) =>
    getService().completionDetails(source, position, name),
};
