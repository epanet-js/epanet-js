import type { ProjectSettings } from "src/lib/project-settings";
import { projectSettingsSchema } from "./schema";

export const serializeProjectSettings = (settings: ProjectSettings): string => {
  const result = projectSettingsSchema.safeParse(settings);
  if (!result.success) {
    throw new Error(
      `Project settings: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};
