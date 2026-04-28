import type { ProjectSettings } from "src/lib/project-settings";
import { projectSettingsSchema } from "./schema";

export const buildProjectSettingsData = (
  data: string | null,
): ProjectSettings => {
  if (data === null) {
    throw new Error("Project settings: data is missing");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch (error) {
    throw new Error("Project settings: data is not valid JSON", {
      cause: error,
    });
  }

  const result = projectSettingsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Project settings: data does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};
