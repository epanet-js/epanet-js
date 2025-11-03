import { Junction, Pipe, Reservoir } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "src/simulation/build-inp";
import { getByLabel } from "src/__helpers__/asset-queries";
import { Valve } from "src/hydraulic-model/asset-types";

describe("Parse inp", () => {
  it("can read values separated by spaces", () => {
    const IDS = { J1: 1 } as const;
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${IDS.J1} ${elevation}

    [COORDINATES]
    ${IDS.J1} ${lng}        ${lat}

    [DEMANDS]
    ${IDS.J1} ${demand}
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction.elevation).toEqual(elevation);
    expect(junction.baseDemand).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);
  });

  it("ignores white lines when reading a section", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const elevation = 100;
    const otherElevation = 200;
    const coordintes = { lat: 10, lng: 20 };
    const otherCoordinates = { lat: 30, lng: 40 };
    const demand = 0.1;
    const otherDemand = 0.2;

    const inp = `
    [JUNCTIONS]
    ${IDS.J1} ${elevation}

    ${IDS.J2} ${otherElevation}

    [COORDINATES]
    ${IDS.J1} ${coordintes.lng}        ${coordintes.lat}



    ${IDS.J2} ${otherCoordinates.lng}        ${otherCoordinates.lat}
    [DEMANDS]
    ${IDS.J1} ${demand}

    ${IDS.J2} ${otherDemand}
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction.elevation).toEqual(elevation);
    expect(junction.baseDemand).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);

    const otherJunction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J2),
    ) as Junction;
    expect(otherJunction.elevation).toEqual(otherElevation);
    expect(otherJunction.baseDemand).toEqual(otherDemand);
    expect(otherJunction.coordinates).toEqual([40, 30]);
  });

  it("ignores comments", () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ;ID\tHEAD
    ${IDS.R1}\t${head};__valuecomment

    [COORDINATES]
    ${IDS.R1}\t${lng}\t${lat};__anothercomment
    ${IDS.J1}\t1\t1

    [JUNCTIONS]
    ${IDS.J1}\t10
    [PIPES]
    ${IDS.P1}\t${IDS.R1}\t${IDS.J1}\t10\t10\t10\t10\tOpen;__anothercommnet
    `;

    const { hydraulicModel } = parseInp(inp);

    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir.id).not.toBeUndefined();
    expect(reservoir.head).toEqual(100);
    expect(reservoir.coordinates).toEqual([lng, lat]);
    const pipe = getByLabel(hydraulicModel.assets, String(IDS.P1)) as Pipe;
    expect(pipe.initialStatus).toEqual("open");
    expect(hydraulicModel.assets.size).toEqual(3);
  });

  it("ignores unsupported sections", () => {
    const IDS = { R1: 1 } as const;
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t${head}

    [COORDINATES]
    ${IDS.R1}\t${lng}\t${lat}

    [EMITTERS]
    ANYTHING
    `;

    const { hydraulicModel } = parseInp(inp);

    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir.id).not.toBeUndefined();
    expect(hydraulicModel.assets.size).toEqual(1);
  });

  it("detects the us customary unit system", () => {
    const IDS = { R1: 1 } as const;
    const head = 100;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t${head}
    [OPTIONS]
    ANY
    Units\tGPM
    ANY
    [COORDINATES]
    ${IDS.R1}\t1\t1
    `;
    const { hydraulicModel, modelMetadata } = parseInp(inp);
    expect(hydraulicModel.units).toMatchObject({
      flow: "gal/min",
    });
    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir.getUnit("head")).toEqual("ft");

    expect(modelMetadata.quantities.getUnit("head")).toEqual("ft");
  });

  it("detects other systems", () => {
    const IDS = { R1: 1 } as const;
    const head = 100;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t${head}
    [OPTIONS]
    ANY
    Units\tLPS
    ANY
    [COORDINATES]
    ${IDS.R1}\t1\t1
    `;
    const { hydraulicModel } = parseInp(inp);
    expect(hydraulicModel.units).toMatchObject({
      flow: "l/s",
    });
    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir.getUnit("head")).toEqual("m");
  });

  it("detects headloss formula from inp", () => {
    const inp = `
    [OPTIONS]
    ANY
    Units\tLPS
    Headloss\tD-W
    ANY
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.headlossFormula).toEqual("D-W");
  });

  it("says when inp contains unsupported sections", () => {
    const inp = `
    [MIXING]
    ANY
    [NEW]
    `;

    const { issues } = parseInp(inp);

    expect(issues!.unsupportedSections!.values()).toContain("[MIXING]");
    expect(issues!.unsupportedSections!.values()).toContain("[NEW]");
  });

  it("ignores default sections", () => {
    const inp = `
    [TITLE]
    ANY
    [REPORT]
    ANY
    `;

    const { issues } = parseInp(inp);

    expect(issues).toBeNull();
  });

  it("says when inp contains invalid duration settigs", () => {
    const inp = `
    [TIMES]
    Duration\t20
    Pattern Start\t10 SEC
    `;

    const { issues } = parseInp(inp);

    expect(issues!.extendedPeriodSimulation).toEqual(true);
    expect([...issues!.nonDefaultTimes!.keys()]).toEqual([
      "DURATION",
      "PATTERN START",
    ]);
  });

  it("says when coordinates are missing", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const elevation = 100;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${IDS.J1}\t${elevation}
    ${IDS.J2}\t${elevation}

    [DEMANDS]
    ${IDS.J1}\t${demand}
    ${IDS.J2}\t${demand}

    [COORDINATES]
    ${IDS.J2}\t10\t10
    `;

    const {
      hydraulicModel: { assets },
      issues,
    } = parseInp(inp);

    expect(issues!.nodesMissingCoordinates!.values()).toContain(String(IDS.J1));
    expect(getByLabel(assets, String(IDS.J1))).toBeUndefined();
    expect(getByLabel(assets, String(IDS.J2))).not.toBeUndefined();
  });

  it("says when coordinates are invalid", () => {
    const IDS = { J1: 1 } as const;
    const elevation = 100;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${IDS.J1}\t${elevation}

    [DEMANDS]
    ${IDS.J1}\t${demand}

    [COORDINATES]
    ${IDS.J1}\t1000\t2000
    `;

    const {
      hydraulicModel: { assets },
      issues,
    } = parseInp(inp);

    expect(issues!.invalidCoordinates!.values()).toContain(String(IDS.J1));
    expect(assets.get(IDS.J1)).toBeUndefined();
  });

  it("says when vertices  are invalid", () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const length = 10;
    const diameter = 100;
    const roughness = 0.1;
    const minorLoss = 0.2;
    const status = "Open";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t${anyNumber}
    [JUNCTIONS]
    ${IDS.J1}\t${anyNumber}
    [PIPES]
    ${IDS.P1}\t${IDS.R1}\t${IDS.J1}\t${length}\t${diameter}\t${roughness}\t${minorLoss}\t${status}

    [COORDINATES]
    ${IDS.R1}\t${10}\t${20}
    ${IDS.J1}\t${30}\t${40}


    [VERTICES]
    ${IDS.P1}\t${1000}\t${60}
    ${IDS.P1}\t${60}\t${700}
    `;

    const {
      hydraulicModel: { assets },
      issues,
    } = parseInp(inp);

    expect(issues!.invalidVertices!.values()).toContain(String(IDS.P1));
    expect(getByLabel(assets, String(IDS.P1))).not.toBeUndefined();
  });

  it("says when using non default options", () => {
    const inp = `
    [OPTIONS]
    Specific Gravity\t2
    Tolerance\t0.00001
    DIFFUSIVITY\t1.0
    TANK MIXING\tMIXED
    Quality\tNONE
    `;

    const { issues } = parseInp(inp);

    expect([...issues!.nonDefaultOptions!.keys()]).toEqual([
      "SPECIFIC GRAVITY",
      "TOLERANCE",
    ]);
  });

  it("supports demo network settings", () => {
    const inp = `
    [OPTIONS]
    Quality\tNONE
    Unbalanced\tCONTINUE 10
    Accuracy\t0.001
    Units\tLPS
    Headloss\tH-W

    [TIMES]
    Duration\t0
    Pattern Start\t0 SEC
 `;
    const { issues } = parseInp(inp);

    expect(issues).toBeNull();
  });

  it("can read settings with spaces", () => {
    const inp = `
    [OPTIONS]
    Quality NONE
    Unbalanced     CONTINUE 10
    Accuracy   0.001
    Units     MGD
    Headloss H-W
 `;
    const { modelMetadata, issues } = parseInp(inp);

    expect(issues).toBeNull();
    expect(modelMetadata.quantities.specName).toEqual("MGD");
  });

  it("treats 'None mg/L' quality setting as equivalent to 'None'", () => {
    const inp = `
    [OPTIONS]
    Quality None mg/L
    Unbalanced CONTINUE 10
    Accuracy 0.001
    Units LPS
    Headloss H-W
    `;
    const { issues } = parseInp(inp);

    expect(issues).toBeNull();
  });

  it("says when override defaults aren't the same", () => {
    const inp = `
    [OPTIONS]
    Unbalanced\tContinue 20
    `;

    const { issues } = parseInp(inp);

    expect(issues!.unbalancedDiff).toEqual({
      defaultSetting: "CONTINUE 10",
      customSetting: "CONTINUE 20",
    });
  });

  it("detects when the inp has been made by the app", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 1] })
      .build();
    let inp = buildInp(hydraulicModel, {
      madeBy: true,
    });

    expect(parseInp(inp).isMadeByApp).toBeTruthy();

    inp += ";some other stuff";

    expect(parseInp(inp).isMadeByApp).toBeFalsy();
  });

  it("provides the count of items in each section", () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ;ID\tHEAD
    ${IDS.R1}\t${head};__valuecomment

    [COORDINATES]
    ${IDS.R1}\t${lng}\t${lat};__anothercomment
    ${IDS.J1}\t1\t1

    [JUNCTIONS]
    ${IDS.J1}\t10
    [PIPES]
    ${IDS.P1}\t${IDS.R1}\t${IDS.J1}\t10\t10\t10\t10\tOpen;__anothercommnet
    `;

    const { stats } = parseInp(inp);

    expect(stats.counts.get("[RESERVOIRS]")).toEqual(1);
    expect(stats.counts.get("[COORDINATES]")).toEqual(2);
    expect(stats.counts.get("[JUNCTIONS]")).toEqual(1);
    expect(stats.counts.get("[PIPES]")).toEqual(1);
  });

  it("skips links without coordinates", () => {
    const IDS = { J1: 1, J2: 2, V1: 3 } as const;
    const diameter = 10;
    const setting = 0.2;
    const type = "FCV";
    const minorLoss = 0.5;
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    ${IDS.J1}\t${anyNumber}
    ${IDS.J2}\t${anyNumber}
    [VALVES]
    ${IDS.V1}\t${IDS.J1}\t${IDS.J2}\t${diameter}\t${type}\t${setting}\t${minorLoss}

    `;

    const { hydraulicModel } = parseInp(inp);

    const valve = getByLabel(hydraulicModel.assets, String(IDS.V1)) as Valve;
    expect(valve).toBeUndefined();
  });

  it("supports singular section names", () => {
    const IDS = { J1: 1, P1: 2, R1: 3 } as const;

    const inp = `
    [JUNCTION]
    ${IDS.J1} 100

    [PIPE]
    ${IDS.P1} ${IDS.R1} ${IDS.J1} 10 10 10 10 Open

    [RESERVOIR]
    ${IDS.R1} 200

    [COORDINATE]
    ${IDS.J1} 1 1
    ${IDS.R1} 2 2

    [DEMAND]
    ${IDS.J1} 0.5
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.assets.size).toEqual(3);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction).toBeDefined();
    expect(junction.elevation).toEqual(100);
    expect(junction.baseDemand).toEqual(0.5);

    const pipe = getByLabel(hydraulicModel.assets, String(IDS.P1)) as Pipe;
    expect(pipe).toBeDefined();
    expect(pipe.length).toEqual(10);

    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir).toBeDefined();
    expect(reservoir.head).toEqual(200);
  });
});
