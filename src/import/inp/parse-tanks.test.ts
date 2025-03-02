import { parseInp } from "./parse-inp";
import { Asset, AssetsMap, Reservoir } from "src/hydraulic-model";

describe("parse tanks", () => {
  it("creates a reservoir from the tank data", () => {
    const tankId = "t1";
    const elevation = 100;
    const initialLevel = 20;
    const lat = 10;
    const lng = -10;
    const inp = `
    [TANKS]
    ${tankId}\t${elevation}\t${initialLevel}\tOTHER_TANK_STUFF

    [COORDINATES]
    ${tankId}\t${lng}\t${lat}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    const reservoir = getByLabel(hydraulicModel.assets, tankId) as Reservoir;
    expect(reservoir.id).not.toBeUndefined();
    expect(reservoir.id).not.toEqual(tankId);
    expect(reservoir.head).toEqual(120);
    expect(reservoir.coordinates).toEqual([-10, 10]);

    expect(issues!.unsupportedSections?.has("[TANKS]")).toBeTruthy();
  });

  it("tolerates references with different case", () => {
    const elevation = 100;
    const initialLevel = 20;
    const lat = 10;
    const lng = -10;
    const inp = `
    [TANKS]
    t1\t${elevation}\t${initialLevel}\tOTHER_TANK_STUFF

    [COORDINATES]
    T1\t${lng}\t${lat}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    const reservoir = getByLabel(hydraulicModel.assets, "t1") as Reservoir;
    expect(reservoir.type).toEqual("reservoir");
    expect(reservoir.head).toEqual(120);
    expect(reservoir.coordinates).toEqual([-10, 10]);

    expect(issues!.unsupportedSections?.has("[TANKS]")).toBeTruthy();
  });

  const getByLabel = (assets: AssetsMap, label: string): Asset | undefined => {
    return [...assets.values()].find((a) => a.label === label);
  };
});
