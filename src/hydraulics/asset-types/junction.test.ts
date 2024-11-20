import { describe, expect, it } from "vitest";
import { Junction } from "./junction";

describe("Junction", () => {
  it("some basic operations with junction", () => {
    const junction = Junction.build({ id: "ID", coordinates: [1, 2] });

    expect(junction.elevation).toEqual(0);

    junction.setElevation(10);
    expect(junction.elevation).toEqual(10);

    const junctionCopy = junction.copy();
    junctionCopy.setElevation(20);

    expect(junctionCopy.elevation).toEqual(20);
    expect(junction.elevation).toEqual(10);
  });

  it("assigns default values", () => {
    const junction = Junction.build();

    expect(junction.elevation).toEqual(0);
    expect(junction.demand).toEqual(0);
    expect(junction.id).not.toBeUndefined();

    const otherJunction = Junction.build();
    expect(otherJunction.id).not.toEqual(junction.id);
  });

  it("can assign values in other units", () => {
    const junction = Junction.build({
      demand: { value: 10, unit: "l/h" },
      elevation: { value: 100, unit: "mm" },
    });

    expect(junction.demand).toBeCloseTo(0.0027);
    expect(junction.elevation).toEqual(0.1);
  });
});
