export type IdPool = "asset" | "pattern" | "curve" | "zone";

export interface IdGenerator {
  get totalGenerated(): number;
  newId(): number;
}

export class ConsecutiveIdsGenerator implements IdGenerator {
  private last: number;
  constructor(startFrom: number = 0) {
    this.last = startFrom;
  }

  newId(): number {
    this.last = this.last + 1;
    return this.last;
  }

  get totalGenerated(): number {
    return this.last;
  }
}

export interface PooledIdGenerator {
  newId(pool: IdPool): number;
  totalGenerated(pool: IdPool): number;
  forPool(pool: IdPool): IdGenerator;
}

export type IdPoolSeeds = Record<IdPool, number>;

export class IdPoolsGenerator implements PooledIdGenerator {
  private generators: Record<IdPool, IdGenerator>;

  constructor(seeds: IdPoolSeeds) {
    this.generators = {
      asset: new ConsecutiveIdsGenerator(seeds.asset),
      pattern: new ConsecutiveIdsGenerator(seeds.pattern),
      curve: new ConsecutiveIdsGenerator(seeds.curve),
      zone: new ConsecutiveIdsGenerator(seeds.zone),
    };
  }

  newId(pool: IdPool): number {
    return this.generators[pool].newId();
  }

  totalGenerated(pool: IdPool): number {
    return this.generators[pool].totalGenerated;
  }

  forPool(pool: IdPool): IdGenerator {
    return this.generators[pool];
  }
}

export const sharedIdPools = (shared: IdGenerator): PooledIdGenerator => ({
  newId: () => shared.newId(),
  totalGenerated: () => shared.totalGenerated,
  forPool: () => shared,
});
