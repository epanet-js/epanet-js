import { ConsecutiveIdsGenerator } from "./index";

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
