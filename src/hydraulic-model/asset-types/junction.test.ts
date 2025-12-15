import { buildJunction } from "../../__helpers__/hydraulic-model-builder";

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
    expect(junction.baseDemand).toEqual(0);
    expect(junction.demands).toEqual([]);
    expect(junction.id).not.toBeUndefined();
  });

  it("can assign baseDemand property", () => {
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

  it("supports demands array with multiple categories", () => {
    const junction = buildJunction({
      demands: [
        { baseDemand: 50, patternId: "pattern1" },
        { baseDemand: 30, patternId: "pattern2" },
      ],
    });

    expect(junction.demands).toHaveLength(2);
    expect(junction.demands[0].baseDemand).toBe(50);
    expect(junction.demands[0].patternId).toBe("pattern1");
    expect(junction.demands[1].baseDemand).toBe(30);
    expect(junction.demands[1].patternId).toBe("pattern2");
  });

  it("copy creates independent demands array", () => {
    const junction = buildJunction({
      baseDemand: 50,
      demands: [{ baseDemand: 50, patternId: "pattern1" }],
    });

    const copy = junction.copy();
    copy.setBaseDemand(100);

    expect(junction.baseDemand).toBe(50);

    expect(copy.baseDemand).toBe(100);
    expect(copy.demands[0].baseDemand).toBe(50);
  });
});
