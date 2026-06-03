import type { Controls } from "@epanet-js/hydraulic-model";
import { createEmptyControls } from "@epanet-js/hydraulic-model";
import { controlsSchema } from "@epanet-js/ejsdb";

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
