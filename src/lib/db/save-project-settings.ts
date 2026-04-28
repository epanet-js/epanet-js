import type { ProjectSettings } from "src/lib/project-settings";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { serializeProjectSettings } from "./mappers/project-settings/to-rows";

export const saveProjectSettings = async (
  settings: ProjectSettings,
): Promise<void> => {
  await timed("saveProjectSettings", async () => {
    const data = serializeProjectSettings(settings);
    const worker = getDbWorker();
    await worker.saveProjectSettings(data);
  });
};
