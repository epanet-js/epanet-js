import { type DbWorkerApi } from "@epanet-js/ejsdb";

const silentWrites = new Set([
  "applyChangeSet",
  "setAllSimulationSettings",
  "saveProjectSettings",
  "setAllZones",
  "insertSelectionSet",
  "renameSelectionSet",
  "deleteSelectionSet",
  "replaceSelectionSetMembers",
  "setAllSelectionSets",
  "saveBookmarks",
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
