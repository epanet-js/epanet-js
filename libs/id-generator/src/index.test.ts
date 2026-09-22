import {
  ConsecutiveIdsGenerator,
  IdPoolsGenerator,
  sharedIdPools,
  withPool,
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

  it("never hands out an observed id", () => {
    const gen = new ConsecutiveIdsGenerator();
    gen.observe(50);

    expect(gen.newId()).toBe(51);
    expect(gen.totalGenerated).toBe(51);
  });

  it("ignores an observed id below the mark", () => {
    const gen = new ConsecutiveIdsGenerator(10);
    gen.observe(3);

    expect(gen.newId()).toBe(11);
  });

  it("carries the observed mark into a copy", () => {
    const gen = new ConsecutiveIdsGenerator();
    gen.observe(7);

    expect(gen.copy().newId()).toBe(8);
  });
});

describe("IdPoolsGenerator", () => {
  const seeds = {
    asset: 0,
    customerPoint: 0,
    pattern: 0,
    curve: 0,
    zone: 0,
  };

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
      customerPoint: 5,
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

  it("raises only the pool an id was observed on", () => {
    const pools = new IdPoolsGenerator(seeds);

    pools.forPool("asset").observe(40);

    expect(pools.newId("asset")).toBe(41);
    expect(pools.newId("pattern")).toBe(1);
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

describe("copy", () => {
  it("starts where its source had reached, then advances independently", () => {
    const source = new ConsecutiveIdsGenerator();
    source.newId();
    source.newId();

    const copy = source.copy();

    expect(copy.newId()).toBe(3);
    expect(copy.newId()).toBe(4);
    expect(source.newId()).toBe(3);
    expect(copy.totalGenerated).toBe(4);
  });
});

describe("withPool", () => {
  it("draws the named pool from the replacement and the rest from the original", () => {
    const pools = new IdPoolsGenerator({
      asset: 10,
      customerPoint: 0,
      pattern: 0,
      curve: 0,
      zone: 0,
    });
    const replacement = new ConsecutiveIdsGenerator(80);

    const swapped = withPool(pools, "customerPoint", replacement);

    expect(swapped.newId("customerPoint")).toBe(81);
    expect(swapped.newId("asset")).toBe(11);
    expect(swapped.forPool("customerPoint")).toBe(replacement);
    expect(swapped.forPool("asset")).toBe(pools.forPool("asset"));
  });

  it("leaves the original pools untouched", () => {
    const pools = new IdPoolsGenerator({
      asset: 0,
      customerPoint: 0,
      pattern: 0,
      curve: 0,
      zone: 0,
    });

    withPool(pools, "customerPoint", new ConsecutiveIdsGenerator(80)).newId(
      "customerPoint",
    );

    expect(pools.newId("customerPoint")).toBe(1);
  });
});
