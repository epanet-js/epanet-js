import type { ChangeSet, EntityKind } from "@epanet-js/change-set";
import {
  ConsecutiveIdsGenerator,
  IdPoolsGenerator,
  sharedIdPools,
  type IdPool,
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

const poolByEntity: Record<EntityKind, IdPool | null> = {
  junction: "asset",
  reservoir: "asset",
  tank: "asset",
  pipe: "asset",
  pump: "asset",
  valve: "asset",
  customerPoint: "customerPoint",
  pattern: "pattern",
  curve: "curve",
  junctionDemand: null,
  customerDemand: null,
  allControls: null,
  customAttributesDefinition: null,
  pipeLibrary: null,
  rawControls: null,
};

export const observeIds = (
  idPools: PooledIdGenerator,
  changeSet: ChangeSet,
): void => {
  for (const record of changeSet.read().records) {
    const pool = poolByEntity[record.entity];
    if (pool === null || typeof record.id !== "number") continue;
    idPools.forPool(pool).observe(record.id);
  }
};
