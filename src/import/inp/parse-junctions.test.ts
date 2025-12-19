import { Asset, AssetsMap, Junction } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";

describe("parse junctions", () => {
  it("includes junctions in the model", () => {
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}

    [COORDINATES]
    ${junctionId}\t${lng}\t${lat}
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = getByLabel(hydraulicModel.assets, "j1") as Junction;
    expect(junction.id).not.toBeUndefined();
    expect(junction.elevation).toEqual(elevation);
    expect(junction.coordinates).toEqual([20, 10]);
  });

  it("tolerates references with different case", () => {
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [JUNCTIONS]
    j1\t${elevation}

    [COORDINATES]
    J1\t${lng}\t${lat}
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    expect(junction.label).toEqual("j1");
  });

  const getByLabel = (assets: AssetsMap, label: string): Asset | undefined => {
    return [...assets.values()].find((a) => a.label === label);
  };
});
