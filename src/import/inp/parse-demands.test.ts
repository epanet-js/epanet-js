import { parseInp } from "./parse-inp";
import { Junction } from "src/hydraulic-model";
import { getByLabel } from "src/__helpers__/asset-queries";

describe("parse demands", () => {
  it("includes demand multiplier when specified", () => {
    const inp = `
    [OPTIONS]
    Demand Multiplier\t20
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.demands.multiplier).toEqual(20);
  });

  it("ignores demands with epanetjs_customers pattern", () => {
    const inp = `
    [JUNCTIONS]
    J1\t100

    [DEMANDS]
    J1\t50
    J1\t25\tepanetjs_customers

    [COORDINATES]
    J1\t0\t0

    [PATTERNS]
    epanetjs_customers\t1
    `;

    const { hydraulicModel } = parseInp(inp);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;

    expect(junction.baseDemand).toEqual(50);
  });
});
