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
    expect(junction.baseDemand).toEqual(0);
    expect(junction.id).not.toBeUndefined();
  });

  it("can assign values", () => {
    const junction = buildJunction({
      baseDemand: 10,
      elevation: 100,
    });

    expect(junction.baseDemand).toEqual(10);
    expect(junction.elevation).toEqual(100);
  });

  it("can set base demand", () => {
    const junction = buildJunction({ baseDemand: 50 });

    expect(junction.baseDemand).toEqual(50);

    junction.setBaseDemand(25);
    expect(junction.baseDemand).toEqual(25);

    junction.setBaseDemand(0);
    expect(junction.baseDemand).toEqual(0);
  });
});
