import { buildJunction } from "../../__helpers__/hydraulic-model-builder";

describe("Junction", () => {
  it("some basic operations with junction", () => {
    const junction = buildJunction({ id: "ID", coordinates: [1, 2] });

    expect(junction.elevation).toEqual(0);

    junction.setElevation(10);
    expect(junction.elevation).toEqual(10);

    const junctionCopy = junction.copy();
    junctionCopy.setElevation(20);

    expect(junctionCopy.elevation).toEqual(20);
    expect(junction.elevation).toEqual(10);
  });

  it("assigns default values", () => {
    const junction = buildJunction();

    expect(junction.elevation).toEqual(0);
    expect(junction.demand).toEqual(0);
    expect(junction.id).not.toBeUndefined();

    const otherJunction = buildJunction();
    expect(otherJunction.id).not.toEqual(junction.id);
  });

  it("can assign values in other units", () => {
    const junction = buildJunction({
      demand: { value: 10, unit: "l/h" },
      elevation: { value: 100, unit: "mm" },
    });

    expect(junction.demand).toBeCloseTo(0.0027);
    expect(junction.elevation).toEqual(0.1);
  });
});
