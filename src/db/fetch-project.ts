import { projectSettingsSchema } from "src/lib/project-settings/project-settings-schema";
import type { ProjectSettings } from "src/lib/project-settings";
import { getDbWorker } from "./get-db-worker";

export type Project = {
  projectSettings: ProjectSettings;
};

export const fetchProject = async (): Promise<Project> => {
  const worker = getDbWorker();
  const settingsJson = await worker.getProjectSettings();
  if (!settingsJson) {
    throw new Error("Project settings missing");
  }
  const projectSettings = projectSettingsSchema.parse(JSON.parse(settingsJson));
  return { projectSettings };
};
