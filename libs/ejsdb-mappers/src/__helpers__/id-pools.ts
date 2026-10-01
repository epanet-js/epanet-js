import { IdPoolsGenerator, type IdPoolSeeds } from "@epanet-js/id-generator";

export const buildTestIdPools = (seeds: Partial<IdPoolSeeds> = {}) =>
  new IdPoolsGenerator({
    asset: 0,
    customerPoint: 0,
    pattern: 0,
    curve: 0,
    zone: 0,
    ...seeds,
  });
