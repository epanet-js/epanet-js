import { parseInp } from "./parse-inp";

describe("parse demands", () => {
  it("includes demand multiplier when specified", () => {
    const inp = `
    [OPTIONS]
    Demand Multiplier\t20
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.demands.multiplier).toEqual(20);
  });
});
