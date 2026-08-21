import {
  emptySessionHistoryDiagnostics,
  SESSION_VERSION,
  type DbWorkerApi,
} from "@epanet-js/ejsdb";

const silentWrites = new Set([
  "applyMoment",
  "setAllSimulationSettings",
  "saveProjectSettings",
  "setAllZones",
  "saveCustomAttributesDefinition",
]);

export const nullDbWorker = new Proxy({} as DbWorkerApi, {
  get: (_target, command: string) => {
    if (silentWrites.has(command)) return () => Promise.resolve();
    if (command === "sessionHistoryFailure") return () => Promise.resolve(null);
    if (command === "restoreSessionFromPool")
      return () => Promise.resolve(false);
    if (command === "sessionHistoryDiagnostics") {
      return () =>
        Promise.resolve(emptySessionHistoryDiagnostics(0, SESSION_VERSION));
    }

    return () => {
      throw new Error(
        `No database open: worker.${command} needs useInProcessDb()`,
      );
    };
  },
});
