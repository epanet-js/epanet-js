import * as Comlink from "comlink";
import type { ScriptLanguageWorkerAPI } from "./worker-api";

let cached: Comlink.Remote<ScriptLanguageWorkerAPI> | null = null;

export const getScriptLanguageWorker =
  (): Comlink.Remote<ScriptLanguageWorkerAPI> => {
    if (!cached) {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
        name: "ScriptLanguageWorker",
      });
      cached = Comlink.wrap<ScriptLanguageWorkerAPI>(worker);
    }
    return cached;
  };
