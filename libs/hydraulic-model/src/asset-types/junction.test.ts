import { buildJunction } from "../test-helpers";

describe("Junction", () => {
  it("some basic operations with junction", () => {
    const junction = buildJunction({ id: 1, coordinates: [1, 2] });

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
    expect(junction.id).not.toBeUndefined();
  });
});
