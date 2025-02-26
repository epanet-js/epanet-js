import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { parseInp } from "./parse-inp";
import { Reservoir } from "src/hydraulic-model";

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

    const reservoir = hydraulicModel.assets.get(tankId) as Reservoir;
    expect(reservoir.id).toEqual(tankId);
    expect(reservoir.type).toEqual("reservoir");
    expect(reservoir.head).toEqual(120);
    expect(reservoir.coordinates).toEqual([-10, 10]);

    expect(issues!.unsupportedSections?.has("[TANKS]")).toBeTruthy();
  });

  it("tolerates references with different case", () => {
    stubFeatureOn("FLAG_CASE_IDS");
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

    const reservoir = hydraulicModel.assets.get("t1") as Reservoir;
    expect(reservoir.id).toEqual("t1");
    expect(reservoir.type).toEqual("reservoir");
    expect(reservoir.head).toEqual(120);
    expect(reservoir.coordinates).toEqual([-10, 10]);

    expect(issues!.unsupportedSections?.has("[TANKS]")).toBeTruthy();
  });
});
