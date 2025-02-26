import { Junction } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

describe("parse junctions", () => {
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

    const { hydraulicModel } = parseInp(inp);

    const junction = hydraulicModel.assets.get(junctionId) as Junction;
    expect(junction.id).toEqual(junctionId);
    expect(junction.elevation).toEqual(elevation);
    expect(junction.demand).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);
  });

  it("can read demand from junction row", () => {
    stubFeatureOn("FLAG_JUNCTION_DEMANDS");
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}\t${demand}

    [COORDINATES]
    ${junctionId}\t${lng}\t${lat}

    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = hydraulicModel.assets.get(junctionId) as Junction;
    expect(junction.id).toEqual(junctionId);
    expect(junction.demand).toEqual(demand);
  });

  it("can apply a custom default pattern", () => {
    stubFeatureOn("FLAG_JUNCTION_DEMANDS");
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}\t${demand}

    [COORDINATES]
    ${junctionId}\t${lng}\t${lat}

    [PATTERNS]
    1\t14

    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = hydraulicModel.assets.get(junctionId) as Junction;
    expect(junction.id).toEqual(junctionId);
    expect(junction.demand).toBeCloseTo(1.4);
  });

  it("assign the initial demand of the pattern", () => {
    stubFeatureOn("FLAG_JUNCTION_DEMANDS");
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}\t${demand}\tPT1

    [COORDINATES]
    ${junctionId}\t${lng}\t${lat}

    [PATTERNS]
    PT1\t2\t20
    PT1\t3\t30
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = hydraulicModel.assets.get(junctionId) as Junction;
    expect(junction.id).toEqual(junctionId);
    expect(junction.demand).toEqual(0.2);
  });

  it("ignores demand defined in junction when in demands", () => {
    stubFeatureOn("FLAG_JUNCTION_DEMANDS");
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}\t${0.1}\tPT1

    [DEMANDS]
    ${junctionId}\t0.5\tPT2
    ${junctionId}\t3\tPT3

    [COORDINATES]
    ${junctionId}\t${lng}\t${lat}

    [PATTERNS]
    PT1\t2\t20
    PT2\t4\t10
    PT3\t-2\t10
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = hydraulicModel.assets.get(junctionId) as Junction;
    expect(junction.id).toEqual(junctionId);
    expect(junction.demand).toEqual(-4);
  });

  it("defaults to default pattern when not specified", () => {
    stubFeatureOn("FLAG_JUNCTION_DEMANDS");
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}\t${0.1}

    [DEMANDS]
    ${junctionId}\t0.5\tPT2
    ${junctionId}\t3

    [COORDINATES]
    ${junctionId}\t${lng}\t${lat}

    [PATTERNS]
    1\t2
    PT2\t4\t10
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = hydraulicModel.assets.get(junctionId) as Junction;
    expect(junction.id).toEqual(junctionId);
    expect(junction.demand).toEqual(8);
  });
});
