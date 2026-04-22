import type { Controls } from "src/hydraulic-model/controls";
import { getDbWorker } from "./get-db-worker";
import { controlsSchema } from "./build-controls-data";

export const serializeControls = (controls: Controls): string => {
  const result = controlsSchema.safeParse(controls);
  if (!result.success) {
    throw new Error(
      `Controls: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};

export const setAllControls = async (controls: Controls): Promise<void> => {
  const data = serializeControls(controls);
  const worker = getDbWorker();
  await worker.setAllControls(data);
};
