import { Junction, Pipe, Reservoir } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "src/simulation/build-inp";
import { getByLabel } from "src/__helpers__/asset-queries";
import { Valve } from "src/hydraulic-model/asset-types";

describe("Parse inp", () => {
  it("can read values separated by spaces", () => {
    const junctionId = "j1";
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${junctionId} ${elevation}

    [COORDINATES]
    ${junctionId} ${lng}        ${lat}

    [DEMANDS]
    ${junctionId} ${demand}
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    expect(junction.elevation).toEqual(elevation);
    expect(junction.baseDemand).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);
  });

  it("ignores white lines when reading a section", () => {
    const junctionId = "j1";
    const otherJunctionId = "j2";
    const elevation = 100;
    const otherElevation = 200;
    const coordintes = { lat: 10, lng: 20 };
    const otherCoordinates = { lat: 30, lng: 40 };
    const demand = 0.1;
    const otherDemand = 0.2;

    const inp = `
    [JUNCTIONS]
    ${junctionId} ${elevation}

    ${otherJunctionId} ${otherElevation}

    [COORDINATES]
    ${junctionId} ${coordintes.lng}        ${coordintes.lat}



    ${otherJunctionId} ${otherCoordinates.lng}        ${otherCoordinates.lat}
    [DEMANDS]
    ${junctionId} ${demand}

    ${otherJunctionId} ${otherDemand}
    `;

    const { hydraulicModel } = parseInp(inp);

    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    expect(junction.elevation).toEqual(elevation);
    expect(junction.baseDemand).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);

    const otherJunction = getByLabel(
      hydraulicModel.assets,
      otherJunctionId,
    ) as Junction;
    expect(otherJunction.elevation).toEqual(otherElevation);
    expect(otherJunction.baseDemand).toEqual(otherDemand);
    expect(otherJunction.coordinates).toEqual([40, 30]);
  });

  it("ignores comments", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ;ID\tHEAD
    ${reservoirId}\t${head};__valuecomment

    [COORDINATES]
    ${reservoirId}\t${lng}\t${lat};__anothercomment
    ${junctionId}\t1\t1

    [JUNCTIONS]
    ${junctionId}\t10
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t10\t10\t10\t10\tOpen;__anothercommnet
    `;

    const { hydraulicModel } = parseInp(inp);

    const reservoir = getByLabel(
      hydraulicModel.assets,
      reservoirId,
    ) as Reservoir;
    expect(reservoir.id).not.toBeUndefined();
    expect(reservoir.head).toEqual(100);
    expect(reservoir.coordinates).toEqual([lng, lat]);
    const pipe = getByLabel(hydraulicModel.assets, pipeId) as Pipe;
    expect(pipe.initialStatus).toEqual("open");
    expect(hydraulicModel.assets.size).toEqual(3);
  });

  it("ignores unsupported sections", () => {
    const reservoirId = "r1";
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${head}

    [COORDINATES]
    ${reservoirId}\t${lng}\t${lat}

    [EMITTERS]
    ANYTHING
    `;

    const { hydraulicModel } = parseInp(inp);

    const reservoir = getByLabel(
      hydraulicModel.assets,
      reservoirId,
    ) as Reservoir;
    expect(reservoir.id).not.toBeUndefined();
    expect(hydraulicModel.assets.size).toEqual(1);
  });

  it("detects the us customary unit system", () => {
    const anyId = "R1";
    const head = 100;
    const inp = `
    [RESERVOIRS]
    ${anyId}\t${head}
    [OPTIONS]
    ANY
    Units\tGPM
    ANY
    [COORDINATES]
    ${anyId}\t1\t1
    `;
    const { hydraulicModel, modelMetadata } = parseInp(inp);
    expect(hydraulicModel.units).toMatchObject({
      flow: "gal/min",
    });
    const reservoir = getByLabel(hydraulicModel.assets, anyId) as Reservoir;
    expect(reservoir.getUnit("head")).toEqual("ft");

    expect(modelMetadata.quantities.getUnit("head")).toEqual("ft");
  });

  it("detects other systems", () => {
    const anyId = "R1";
    const head = 100;
    const inp = `
    [RESERVOIRS]
    ${anyId}\t${head}
    [OPTIONS]
    ANY
    Units\tLPS
    ANY
    [COORDINATES]
    ${anyId}\t1\t1
    `;
    const { hydraulicModel } = parseInp(inp);
    expect(hydraulicModel.units).toMatchObject({
      flow: "l/s",
    });
    const reservoir = getByLabel(hydraulicModel.assets, anyId) as Reservoir;
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
    const junctionId = "j1";
    const otherJunctionId = "j2";
    const elevation = 100;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}
    ${otherJunctionId}\t${elevation}

    [DEMANDS]
    ${junctionId}\t${demand}
    ${otherJunctionId}\t${demand}

    [COORDINATES]
    ${otherJunctionId}\t10\t10
    `;

    const {
      hydraulicModel: { assets },
      issues,
    } = parseInp(inp);

    expect(issues!.nodesMissingCoordinates!.values()).toContain(junctionId);
    expect(getByLabel(assets, junctionId)).toBeUndefined();
    expect(getByLabel(assets, otherJunctionId)).not.toBeUndefined();
  });

  it("says when coordinates are invalid", () => {
    const junctionId = "j1";
    const elevation = 100;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${junctionId}\t${elevation}

    [DEMANDS]
    ${junctionId}\t${demand}

    [COORDINATES]
    ${junctionId}\t1000\t2000
    `;

    const {
      hydraulicModel: { assets },
      issues,
    } = parseInp(inp);

    expect(issues!.invalidCoordinates!.values()).toContain(junctionId);
    expect(assets.get(junctionId)).toBeUndefined();
  });

  it("says when vertices  are invalid", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const length = 10;
    const diameter = 100;
    const roughness = 0.1;
    const minorLoss = 0.2;
    const status = "Open";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t${length}\t${diameter}\t${roughness}\t${minorLoss}\t${status}

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}


    [VERTICES]
    ${pipeId}\t${1000}\t${60}
    ${pipeId}\t${60}\t${700}
    `;

    const {
      hydraulicModel: { assets },
      issues,
    } = parseInp(inp);

    expect(issues!.invalidVertices!.values()).toContain(pipeId);
    expect(getByLabel(assets, pipeId)).not.toBeUndefined();
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
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("junction1", { coordinates: [10, 1] })
      .build();
    let inp = buildInp(hydraulicModel, {
      madeBy: true,
    });

    expect(parseInp(inp).isMadeByApp).toBeTruthy();

    inp += ";some other stuff";

    expect(parseInp(inp).isMadeByApp).toBeFalsy();
  });

  it("provides the count of items in each section", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pipeId = "p1";
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ;ID\tHEAD
    ${reservoirId}\t${head};__valuecomment

    [COORDINATES]
    ${reservoirId}\t${lng}\t${lat};__anothercomment
    ${junctionId}\t1\t1

    [JUNCTIONS]
    ${junctionId}\t10
    [PIPES]
    ${pipeId}\t${reservoirId}\t${junctionId}\t10\t10\t10\t10\tOpen;__anothercommnet
    `;

    const { stats } = parseInp(inp);

    expect(stats.counts.get("[RESERVOIRS]")).toEqual(1);
    expect(stats.counts.get("[COORDINATES]")).toEqual(2);
    expect(stats.counts.get("[JUNCTIONS]")).toEqual(1);
    expect(stats.counts.get("[PIPES]")).toEqual(1);
  });

  it("skips links without coordinates", () => {
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

    `;

    const { hydraulicModel } = parseInp(inp);

    const valve = getByLabel(hydraulicModel.assets, valveId) as Valve;
    expect(valve).toBeUndefined();
  });
});
