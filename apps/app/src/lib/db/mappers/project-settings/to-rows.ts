import type { ProjectSettings } from "@epanet-js/project-settings";
import { projectSettingsSchema } from "@epanet-js/ejsdb";

export const serializeProjectSettings = (settings: ProjectSettings): string => {
  const result = projectSettingsSchema.safeParse(settings);
  if (!result.success) {
    throw new Error(
      `Project settings: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};
