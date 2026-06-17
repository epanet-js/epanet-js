import type { RawControls } from "@epanet-js/hydraulic-model";
import { createEmptyRawControls } from "@epanet-js/hydraulic-model";
import { rawControlsSchema } from "@epanet-js/ejsdb";

export const buildRawControlsData = (data: string | null): RawControls => {
  if (data === null) return createEmptyRawControls();

  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch (error) {
    throw new Error("Controls: data is not valid JSON", { cause: error });
  }

  const result = rawControlsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Controls: data does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};
