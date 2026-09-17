import type { IdPoolSeeds } from "@epanet-js/id-generator";
import { idPoolsSchema } from "@epanet-js/ejsdb";

export const serializeIdPools = (seeds: IdPoolSeeds): string => {
  const result = idPoolsSchema.safeParse(seeds);
  if (!result.success) {
    throw new Error(
      `Id pools: data does not match schema — ${result.error.message}`,
    );
  }
  return JSON.stringify(result.data);
};
