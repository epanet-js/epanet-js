import type { ProjectSettings } from "src/lib/project-settings";
import { projectSettingsSchema } from "src/lib/project-settings/project-settings-schema";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";

export const saveProjectSettings = async (
  settings: ProjectSettings,
): Promise<void> => {
  await timed("saveProjectSettings", async () => {
    const validated = projectSettingsSchema.parse(settings);
    const worker = getDbWorker();
    await worker.saveProjectSettings(JSON.stringify(validated));
  });
};
