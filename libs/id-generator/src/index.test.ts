import {
  ConsecutiveIdsGenerator,
  IdPoolsGenerator,
  sharedIdPools,
} from "./index";

describe("ConsecutiveIdsGenerator", () => {
  it("produces sequential ids starting from 1 by default", () => {
    const gen = new ConsecutiveIdsGenerator();
    expect(gen.newId()).toBe(1);
    expect(gen.newId()).toBe(2);
    expect(gen.newId()).toBe(3);
  });

  it("starts after the given seed and tracks totalGenerated", () => {
    const gen = new ConsecutiveIdsGenerator(10);
    expect(gen.newId()).toBe(11);
    expect(gen.newId()).toBe(12);
    expect(gen.totalGenerated).toBe(12);
  });
});

describe("IdPoolsGenerator", () => {
  const seeds = { asset: 0, pattern: 0, curve: 0, zone: 0 };

  it("advances each pool independently", () => {
    const pools = new IdPoolsGenerator(seeds);

    expect(pools.newId("asset")).toBe(1);
    expect(pools.newId("pattern")).toBe(1);
    expect(pools.newId("asset")).toBe(2);
    expect(pools.newId("pattern")).toBe(2);
  });

  it("starts each pool after its own seed", () => {
    const pools = new IdPoolsGenerator({
      asset: 10,
      pattern: 3,
      curve: 7,
      zone: 0,
    });

    expect(pools.newId("asset")).toBe(11);
    expect(pools.newId("pattern")).toBe(4);
    expect(pools.newId("curve")).toBe(8);
    expect(pools.newId("zone")).toBe(1);
  });

  it("reports the highest id handed out per pool", () => {
    const pools = new IdPoolsGenerator(seeds);
    pools.newId("asset");
    pools.newId("asset");
    pools.newId("pattern");

    expect(pools.totalGenerated("asset")).toBe(2);
    expect(pools.totalGenerated("pattern")).toBe(1);
    expect(pools.totalGenerated("curve")).toBe(0);
  });

  it("hands out a generator bound to one pool", () => {
    const pools = new IdPoolsGenerator(seeds);
    const patterns = pools.forPool("pattern");

    expect(patterns.newId()).toBe(1);
    expect(pools.newId("pattern")).toBe(2);
    expect(patterns.totalGenerated).toBe(2);
  });
});

describe("sharedIdPools", () => {
  it("draws every pool from the one generator", () => {
    const pools = sharedIdPools(new ConsecutiveIdsGenerator());

    expect(pools.newId("asset")).toBe(1);
    expect(pools.newId("pattern")).toBe(2);
    expect(pools.newId("curve")).toBe(3);
    expect(pools.totalGenerated("zone")).toBe(3);
  });

  it("hands out the same generator for every pool", () => {
    const shared = new ConsecutiveIdsGenerator();
    const pools = sharedIdPools(shared);

    expect(pools.forPool("asset")).toBe(shared);
    expect(pools.forPool("pattern")).toBe(shared);
  });
});
