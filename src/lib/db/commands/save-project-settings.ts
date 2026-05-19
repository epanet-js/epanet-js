import type { ProjectSettings } from "src/lib/project-settings";
import { getWorker, timed } from "src/lib/ejsdb";
import { serializeProjectSettings } from "../mappers/project-settings/to-rows";

export const saveProjectSettings = async (
  settings: ProjectSettings,
): Promise<void> => {
  await timed("saveProjectSettings", async () => {
    const data = serializeProjectSettings(settings);
    const worker = getWorker();
    await worker.saveProjectSettings(data);
  });
};
