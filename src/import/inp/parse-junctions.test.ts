import { Asset, AssetsMap, Junction } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";

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

    const junction = getByLabel(hydraulicModel.assets, "j1") as Junction;
    expect(junction.id).not.toBeUndefined();
    expect(junction.elevation).toEqual(elevation);
    expect(junction.baseDemand).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);
  });

  it("can read demand from junction row", () => {
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

    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    expect(junction.baseDemand).toEqual(demand);
  });

  it("can apply a custom default pattern", () => {
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

    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    expect(junction.baseDemand).toBeCloseTo(1.4);
  });

  it("assign the initial demand of the pattern", () => {
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

    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    expect(junction.baseDemand).toEqual(0.2);
  });

  it("ignores demand defined in junction when in demands", () => {
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

    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    expect(junction.baseDemand).toEqual(-4);
  });

  it("defaults to default pattern when not specified", () => {
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

    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    expect(junction.baseDemand).toEqual(8);
  });

  it("tolerates references with different case", () => {
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [JUNCTIONS]
    j1\t${elevation}\t${0.1}

    [DEMANDS]
    J1\t0.5\tPt2
    j1\t3

    [COORDINATES]
    J1\t${lng}\t${lat}

    [PATTERNS]
    1\t2
    pT2\t4\t10
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    expect(junction.label).toEqual("j1");
    expect(junction.baseDemand).toEqual(8);
  });

  const getByLabel = (assets: AssetsMap, label: string): Asset | undefined => {
    return [...assets.values()].find((a) => a.label === label);
  };
});
