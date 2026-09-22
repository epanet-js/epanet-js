import {
  ConsecutiveIdsGenerator,
  IdPoolsGenerator,
  sharedIdPools,
  type IdPoolSeeds,
  type PooledIdGenerator,
} from "@epanet-js/id-generator";

export const emptyIdPoolSeeds: IdPoolSeeds = {
  asset: 0,
  customerPoint: 0,
  pattern: 0,
  curve: 0,
  zone: 0,
};

export const buildIdPools = (
  withPools: boolean,
  seeds: IdPoolSeeds = emptyIdPoolSeeds,
): PooledIdGenerator =>
  withPools
    ? new IdPoolsGenerator(seeds)
    : sharedIdPools(new ConsecutiveIdsGenerator(seeds.asset));
