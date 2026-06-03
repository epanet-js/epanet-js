import type { Controls } from "@epanet-js/hydraulic-model";
import { controlsSchema } from "@epanet-js/ejsdb";

export const serializeControls = (controls: Controls): string => {
  const result = controlsSchema.safeParse(controls);
  if (!result.success) {
    throw new Error(
      `Controls: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};
