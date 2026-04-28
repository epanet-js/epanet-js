import type { Controls } from "src/hydraulic-model/controls";
import { createEmptyControls } from "src/hydraulic-model/controls";
import { controlsSchema } from "./schema";

export const buildControlsData = (data: string | null): Controls => {
  if (data === null) return createEmptyControls();

  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch (error) {
    throw new Error("Controls: data is not valid JSON", { cause: error });
  }

  const result = controlsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Controls: data does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};
