import type { IdPoolSeeds } from "@epanet-js/id-generator";
import { idPoolsSchema } from "@epanet-js/ejsdb";

export const buildIdPoolsData = (data: string | null): IdPoolSeeds | null => {
  if (data === null) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch (error) {
    throw new Error("Id pools: data is not valid JSON", { cause: error });
  }

  const result = idPoolsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Id pools: data does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
};
