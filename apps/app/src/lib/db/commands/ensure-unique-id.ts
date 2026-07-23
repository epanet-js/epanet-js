import { v4 as uuidv4 } from "uuid";
import { getWorker, timed } from "@epanet-js/ejsdb";
import { buildProjectSettingsData } from "../mappers/project-settings/builders";
import { serializeProjectSettings } from "../mappers/project-settings/to-rows";

export const newUniqueId = (): string => uuidv4();

export const ensureUniqueId = async (): Promise<string> => {
  return timed("ensureUniqueId", async () => {
    const worker = getWorker();
    const settingsJson = await worker.getProjectSettings();
    if (settingsJson === null) {
      throw new Error("ensureUniqueId: project settings are missing");
    }

    const settings = buildProjectSettingsData(settingsJson);
    if (settings.uniqueId) return settings.uniqueId;

    const uniqueId = newUniqueId();
    await worker.saveProjectSettings(
      serializeProjectSettings({ ...settings, uniqueId }),
    );
    return uniqueId;
  });
};
