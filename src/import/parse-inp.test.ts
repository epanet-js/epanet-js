import { Junction } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";

describe("Parse inp", () => {
  it("includes junctions in the model", () => {
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}

    [COORDINATES]
    ${junctionId}\t${lng}\t${lat}

    [DEMANDS]
    ${junctionId}\t${demand}
    `;

    const hydraulicModel = parseInp(inp);

    const junction = hydraulicModel.assets.get(junctionId) as Junction;
    expect(junction.id).toEqual(junctionId);
    expect(junction.elevation).toEqual(elevation);
    expect(junction.demand).toEqual(demand);
  });
});
