import type { RawControls } from "@epanet-js/hydraulic-model";
import { rawControlsSchema } from "@epanet-js/ejsdb";

export const serializeRawControls = (controls: RawControls): string => {
  const result = rawControlsSchema.safeParse(controls);
  if (!result.success) {
    throw new Error(
      `Controls: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};
