import { describe, it, expect } from "vitest";
import { IdMapper } from "./id-mapper";

describe("IdMapper", () => {
  it("assigns sequential indices to new IDs", () => {
    const mapper = new IdMapper();

    expect(mapper.getOrAssignIdx(1)).toBe(0);
    expect(mapper.getOrAssignIdx(2)).toBe(1);
    expect(mapper.getOrAssignIdx(3)).toBe(2);
  });

  it("returns same index for duplicate IDs", () => {
    const mapper = new IdMapper();

    const idx1 = mapper.getOrAssignIdx(1);
    const idx2 = mapper.getOrAssignIdx(1);

    expect(idx1).toBe(idx2);
    expect(idx1).toBe(0);
  });

  it("maintains correct lookup array", () => {
    const mapper = new IdMapper();

    mapper.getOrAssignIdx(1);
    mapper.getOrAssignIdx(2);
    mapper.getOrAssignIdx(3);

    const lookup = mapper.getIdsLookup();
    expect(lookup).toEqual([1, 2, 3]);
  });

  it("handles mixed order insertions", () => {
    const mapper = new IdMapper();

    mapper.getOrAssignIdx(3);
    mapper.getOrAssignIdx(1);
    mapper.getOrAssignIdx(3);
    mapper.getOrAssignIdx(2);

    expect(mapper.getIdsLookup()).toEqual([3, 1, 2]);
  });
});
