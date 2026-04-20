import type { ProjectSettings } from "src/lib/project-settings";
import { getDbWorker } from "./get-db-worker";

export const saveProjectSettings = async (
  settings: ProjectSettings,
): Promise<void> => {
  const worker = getDbWorker();
  await worker.saveProjectSettings(JSON.stringify(settings));
};
