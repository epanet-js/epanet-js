import type { PipeMaterial } from "src/lib/pipe-library";
import { pipeLibrarySchema } from "@epanet-js/ejsdb";

export const buildPipeLibraryData = (data: string | null): PipeMaterial[] => {
  if (data === null) {
    return [];
  }

  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch (error) {
    throw new Error("Pipe library: data is not valid JSON", {
      cause: error,
    });
  }

  const result = pipeLibrarySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Pipe library: data does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};
