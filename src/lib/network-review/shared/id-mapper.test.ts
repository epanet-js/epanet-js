import { describe, it, expect } from "vitest";
import { IdMapper } from "./id-mapper";

describe("IdMapper", () => {
  it("assigns sequential indices to new IDs", () => {
    const mapper = new IdMapper();

    expect(mapper.getOrAssignIdx("J1")).toBe(0);
    expect(mapper.getOrAssignIdx("J2")).toBe(1);
    expect(mapper.getOrAssignIdx("P1")).toBe(2);
  });

  it("returns same index for duplicate IDs", () => {
    const mapper = new IdMapper();

    const idx1 = mapper.getOrAssignIdx("J1");
    const idx2 = mapper.getOrAssignIdx("J1");

    expect(idx1).toBe(idx2);
    expect(idx1).toBe(0);
  });

  it("maintains correct lookup array", () => {
    const mapper = new IdMapper();

    mapper.getOrAssignIdx("J1");
    mapper.getOrAssignIdx("J2");
    mapper.getOrAssignIdx("P1");

    const lookup = mapper.getIdsLookup();
    expect(lookup).toEqual(["J1", "J2", "P1"]);
  });

  it("handles mixed order insertions", () => {
    const mapper = new IdMapper();

    mapper.getOrAssignIdx("P1");
    mapper.getOrAssignIdx("J1");
    mapper.getOrAssignIdx("P1");
    mapper.getOrAssignIdx("J2");

    expect(mapper.getIdsLookup()).toEqual(["P1", "J1", "J2"]);
  });
});
