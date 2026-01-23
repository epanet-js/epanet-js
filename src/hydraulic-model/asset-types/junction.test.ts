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
    expect(junction.constantDemand).toEqual(0);
    expect(junction.demands).toEqual([]);
    expect(junction.id).not.toBeUndefined();
  });

  it("can assign demands via builder", () => {
    const junction = buildJunction({
      demands: [{ baseDemand: 10 }],
      elevation: 100,
    });

    expect(junction.constantDemand).toEqual(10);
    expect(junction.demands).toEqual([{ baseDemand: 10 }]);
    expect(junction.elevation).toEqual(100);
  });

  it("can set demands", () => {
    const junction = buildJunction({ demands: [{ baseDemand: 50 }] });

    expect(junction.constantDemand).toEqual(50);

    junction.setDemands([{ baseDemand: 25 }]);
    expect(junction.constantDemand).toEqual(25);

    junction.setDemands([]);
    expect(junction.constantDemand).toEqual(0);
  });

  it("supports demands array with multiple categories", () => {
    const junction = buildJunction({
      demands: [
        { baseDemand: 50, patternId: 1 },
        { baseDemand: 30, patternId: 2 },
      ],
    });

    expect(junction.demands).toHaveLength(2);
    expect(junction.demands[0].baseDemand).toBe(50);
    expect(junction.demands[0].patternId).toBe(1);
    expect(junction.demands[1].baseDemand).toBe(30);
    expect(junction.demands[1].patternId).toBe(2);
  });

  it("copy creates independent demands array", () => {
    const junction = buildJunction({
      demands: [{ baseDemand: 50, patternId: 1 }],
    });

    const copy = junction.copy();
    copy.setDemands([{ baseDemand: 100 }]);

    expect(junction.demands[0].baseDemand).toBe(50);
    expect(copy.demands[0].baseDemand).toBe(100);
  });

  describe("constantDemand", () => {
    it("returns 0 when demands is empty", () => {
      const junction = buildJunction();
      expect(junction.constantDemand).toEqual(0);
    });

    it("returns 0 when no constant demand exists", () => {
      const junction = buildJunction({
        demands: [
          { baseDemand: 50, patternId: 1 },
          { baseDemand: 30, patternId: 2 },
        ],
      });
      expect(junction.constantDemand).toEqual(0);
    });

    it("returns sum of constant demands", () => {
      const junction = buildJunction({
        demands: [
          { baseDemand: 20 },
          { baseDemand: 50, patternId: 1 },
          { baseDemand: 15 },
          { baseDemand: 30, patternId: 2 },
          { baseDemand: 10 },
        ],
      });
      expect(junction.constantDemand).toEqual(45); // 20 + 15 + 10
    });
  });
});
