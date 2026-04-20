import type { ProjectSettings } from "src/lib/project-settings";
import { projectSettingsSchema } from "src/lib/project-settings/project-settings-schema";
import { getDbWorker } from "./get-db-worker";

export const saveProjectSettings = async (
  settings: ProjectSettings,
): Promise<void> => {
  const validated = projectSettingsSchema.parse(settings);
  const worker = getDbWorker();
  await worker.saveProjectSettings(JSON.stringify(validated));
};
