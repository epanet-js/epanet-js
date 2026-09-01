import { type DbWorkerApi } from "@epanet-js/ejsdb";

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
    return () => {
      throw new Error(
        `No database open: worker.${command} needs useInProcessDb()`,
      );
    };
  },
});
