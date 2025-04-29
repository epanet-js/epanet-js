import { Junction } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { getByLabel } from "src/__helpers__/asset-queries";
import { Valve } from "src/hydraulic-model/asset-types";

describe("parse valves", () => {
  it("parses a valve", () => {
    const valveId = "v1";
    const diameter = 10;
    const setting = 0.2;
    const type = "FCV";
    const minorLoss = 0.5;
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}
    [VALVES]
    ${valveId}\tj1\tj2\t${diameter}\t${type}\t${setting}\t${minorLoss}

    [COORDINATES]
    j1\t${10}\t${20}
    j2\t${30}\t${40}


    [VERTICES]
    ${valveId}\t${50}\t${60}
    ${valveId}\t${60}\t${70}
    `;

    const { hydraulicModel } = parseInp(inp);

    const valve = getByLabel(hydraulicModel.assets, valveId) as Valve;
    const j1 = getByLabel(hydraulicModel.assets, "j1") as Junction;
    const j2 = getByLabel(hydraulicModel.assets, "j2") as Junction;
    expect(valve.initialStatus).toEqual("active");
    expect(valve.valveType).toEqual("fcv");
    expect(valve.setting).toEqual(0.2);
    expect(valve.diameter).toEqual(10);
    expect(valve.minorLoss).toEqual(0.5);
    expect(valve.connections).toEqual([j1.id, j2.id]);
    expect(valve.coordinates).toEqual([
      [10, 20],
      [50, 60],
      [60, 70],
      [30, 40],
    ]);
    expect(hydraulicModel.topology.hasLink(valve.id)).toBeTruthy();
  });

  it("overrides initial status with status section", () => {
    const diameter = 10;
    const setting = 0.2;
    const type = "FCV";
    const minorLoss = 0.5;
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}
    j3\t${anyNumber}
    j4\t${anyNumber}

    [VALVES]
    v1\tj1\tj2\t${diameter}\t${type}\t${setting}\t${minorLoss}
    v2\tj2\tj3\t${diameter}\t${type}\t${setting}\t${minorLoss}
    v3\tj3\tj4\t${diameter}\t${type}\t${setting}\t${minorLoss}

    [STATUS]
    v1\tOPEN
    v2\tCLOSED

    [COORDINATES]
    j1\t${10}\t${20}
    j2\t${30}\t${40}
    j3\t${30}\t${40}
    j4\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp);

    const v1 = getByLabel(hydraulicModel.assets, "v1") as Valve;
    expect(v1.initialStatus).toEqual("open");
    const v2 = getByLabel(hydraulicModel.assets, "v2") as Valve;
    expect(v2.initialStatus).toEqual("closed");
    const v3 = getByLabel(hydraulicModel.assets, "v3") as Valve;
    expect(v3.initialStatus).toEqual("active");
  });

  it("is case insensitive", () => {
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}
    [VALVES]
    v1\tj1\tJ2\t10\tfCv\t0.2\t9

    [STATUS]
    V1\tClosed

    [COORDINATES]
    J1\t${10}\t${20}
    j2\t${30}\t${40}

    [VERTICES]
    v1\t${50}\t${60}
    V1\t${60}\t${70}
    `;

    const { hydraulicModel } = parseInp(inp);

    const v1 = getByLabel(hydraulicModel.assets, "v1") as Valve;
    const j1 = getByLabel(hydraulicModel.assets, "j1") as Junction;
    const j2 = getByLabel(hydraulicModel.assets, "j2") as Junction;
    expect(v1.initialStatus).toEqual("closed");
    expect(v1.valveType).toEqual("fcv");
    expect(v1.connections).toEqual([j1.id, j2.id]);
    expect(v1.coordinates).toEqual([
      [10, 20],
      [50, 60],
      [60, 70],
      [30, 40],
    ]);
    expect(hydraulicModel.topology.hasLink(v1.id)).toBeTruthy();
  });

  it("reports warning when using GPVs", () => {
    const type = "GPV";
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}

    [VALVES]
    v1\tj1\tj2\t${anyNumber}\t${type}\t${anyNumber}\t${anyNumber}

    [COORDINATES]
    j1\t${10}\t${20}
    j2\t${30}\t${40}
    `;

    const { issues, hydraulicModel } = parseInp(inp);

    expect(issues!.gpvValves).toBeTruthy();

    const v1 = getByLabel(hydraulicModel.assets, "v1") as Valve;
    expect(v1.valveType).toEqual("tcv");
  });
});
