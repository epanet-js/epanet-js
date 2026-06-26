import type { PipeMaterial } from "@epanet-js/pipe-library";
import { pipeLibrarySchema } from "@epanet-js/ejsdb";

export const serializePipeLibrary = (materials: PipeMaterial[]): string => {
  const result = pipeLibrarySchema.safeParse(materials);
  if (!result.success) {
    throw new Error(
      `Pipe library: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};
