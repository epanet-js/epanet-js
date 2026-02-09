import { Junction, Pump, Reservoir } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { getByLabel } from "src/__helpers__/asset-queries";

describe("parse pumps", () => {
  it("parses a pump", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const power = 10;
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tPOWER ${power}

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}


    [VERTICES]
    ${pumpId}\t${50}\t${60}
    ${pumpId}\t${60}\t${70}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    const junction = getByLabel(hydraulicModel.assets, junctionId) as Junction;
    const reservoir = getByLabel(
      hydraulicModel.assets,
      reservoirId,
    ) as Reservoir;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.definitionType).toEqual("power");
    expect(pump.power).toEqual(power);
    expect(pump.connections).toEqual([reservoir.id, junction.id]);
    expect(pump.coordinates).toEqual([
      [10, 20],
      [50, 60],
      [60, 70],
      [30, 40],
    ]);
    expect(hydraulicModel.topology.hasLink(pump.id)).toBeTruthy();
  });

  it("parses a pump with 1-point curve as design-point type", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const curveLabel = "cu1";
    const anyNumber = 10;
    const designFlow = 100;
    const designHead = 200;

    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tHEAD ${curveLabel}

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveLabel}\t${designFlow}\t${designHead}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.definitionType).toEqual("curve");
    expect(pump.curve).toEqual([{ x: designFlow, y: designHead }]);
    expect(hydraulicModel.curves.size).toBe(0);
  });

  it("parses a pump with 3-point curve as standard type", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const curveLabel = "cu1";
    const anyNumber = 10;

    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tHEAD ${curveLabel}

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveLabel}\t0\t300
    ${curveLabel}\t100\t250
    ${curveLabel}\t200\t150
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.definitionType).toEqual("curve");
    expect(pump.curve).toEqual([
      { x: 0, y: 300 },
      { x: 100, y: 250 },
      { x: 200, y: 150 },
    ]);
    expect(hydraulicModel.curves.size).toBe(0);
  });

  it("can read status from section", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const curveId = "cu1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tHEAD ${curveId}

    [STATUS]
    ${pumpId}\tCLOSED

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}

    [CURVES]
    ${curveId}\t100\t200
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("off");
  });

  it("overrides speed setting with value from status section", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tSPEED 0.8\tPOWER 10

    [STATUS]
    ${pumpId}\t0.7

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.speed).toEqual(0.7);
  });

  it("preserves initial status when speed is 0", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tSPEED 0\tPOWER 10

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.speed).toEqual(0);
  });

  it("overrides speed setting when forced to open", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tSPEED 0.8\tPOWER 10

    [STATUS]
    ${pumpId}\tOPEN

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.speed).toEqual(1);
  });

  it("overrides speed setting when using a pattern", () => {
    const pumpId = "pu1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}
    [PUMPS]
    ${pumpId}\tj1\tj2\tSPEED 0.8\tPATTERN PAT_1\tPOWER 10

    [STATUS]
    ${pumpId}\tOPEN


    [PATTERNS]
    PAT_1 0.2

    [COORDINATES]
    j1\t10\t20
    j2\t10\t20
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.speed).toEqual(0.2);
  });

  it("preserves speed setting when status is off", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tSPEED 0.8\tPOWER 10

    [STATUS]
    ${pumpId}\tCLOSED

    [COORDINATES]
    ${reservoirId}\t${10}\t${20}
    ${junctionId}\t${30}\t${40}
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("off");
    expect(pump.speed).toEqual(0.8);
  });

  it("matches pump curve with different casing", () => {
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}
    j3\t${anyNumber}
    [PUMPS]
    pu1\tj1\tj2\tspeed 0.8\tpoWer 10
    pu2\tJ2\tj3\thEaD Cu_1

    [CURVES]
    CU_1\t10\t20

    [STATUS]
    pU2\tClosed

    [COORDINATES]
    J1\t${10}\t${20}
    J2\t${10}\t${20}
    j3\t${10}\t${20}
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.curves.size).toBe(0);

    const pump1 = getByLabel(hydraulicModel.assets, "pu1") as Pump;
    expect(pump1.speed).toEqual(0.8);
    expect(pump1.definitionType).toEqual("power");
    expect(pump1.power).toEqual(10);

    const pump2 = getByLabel(hydraulicModel.assets, "pu2") as Pump;
    expect(pump2.definitionType).toEqual("curve");
    expect(pump2.initialStatus).toEqual("off");
    expect(pump2.curve).toEqual([{ x: 10, y: 20 }]);
  });

  it("doesnt include issue when curve is a single point", () => {
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}

    [PUMPS]
    pu1\tj1\tj2\tHEAD CU_1

    [CURVES]
    CU_1\t10\t20

    [COORDINATES]
    j1\t${10}\t${20}
    j2\t${10}\t${20}
    `;

    const { issues } = parseInp(inp);

    expect(issues?.unsupportedSections).toBeUndefined();
  });

  it("doesnt include issue when curve is a valid 3-point standard curve", () => {
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}

    [PUMPS]
    pu1\tj1\tj2\tHEAD CU_1

    [CURVES]
    CU_1\t0\t300
    CU_1\t100\t250
    CU_1\t200\t150

    [COORDINATES]
    j1\t${10}\t${20}
    j2\t${10}\t${20}
    `;

    const { issues } = parseInp(inp);

    expect(issues?.unsupportedSections).toBeUndefined();
  });

  it("falls back to design-point mode when curve is invalid (2 points)", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const curveLabel = "cu1";
    const anyNumber = 10;

    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tHEAD ${curveLabel}

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveLabel}\t100\t200
    ${curveLabel}\t200\t300
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    expect(issues?.hasPumpCurves).toBe(1);
    expect(hydraulicModel.curves.size).toBe(0);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("curve");
    expect(pump.curve).toEqual([{ x: 200, y: 300 }]);
  });

  it("falls back to design-point mode when 3-point curve has non-ascending flow values", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const curveLabel = "cu1";
    const anyNumber = 10;

    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tHEAD ${curveLabel}

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveLabel}\t0\t300
    ${curveLabel}\t200\t250
    ${curveLabel}\t100\t150
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    expect(hydraulicModel.curves.size).toBe(0);
    expect(issues?.hasPumpCurves).toBe(1);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("curve");
    expect(pump.curve).toEqual([{ x: 200, y: 250 }]);
  });

  it("falls back to design-point mode when curve is missing", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const curveLabel = "cu1";
    const anyNumber = 10;

    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tHEAD ${curveLabel}

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("curve");
    expect(pump.curve).toEqual([{ x: 1, y: 1 }]);
  });

  it("parses power-based pump correctly", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const power = 75;
    const anyNumber = 10;

    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tPOWER ${power}

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40
    `;

    const { hydraulicModel } = parseInp(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("power");
    expect(pump.power).toEqual(power);
  });

  it("can read multiple settings", () => {
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}
    j3\t${anyNumber}
    j4\t${anyNumber}
    j5\t${anyNumber}
    j6\t${anyNumber}
    [PUMPS]
    pu1\tj1\tj2\tSPEED 0.8\tPOWER 10
    pu2\tj2\tj3\tPOWER 22\tSPEED 0.4
    pu3\tj3\tj4\tSPEED 20\tHEAD CU_1
    pu4\tj4\tj5\tHEAD CU_1\tSPEED 0.2
    pu5\tj5\tj6\tPATTERN PAT_1\tSPEED 0.2\tPOWER 10

    [CURVES]
    CU_1\t10\t20

    [PATTERNS]
    PAT_1 0.9

    [COORDINATES]
    j1\t${10}\t${20}
    j2\t${10}\t${20}
    j3\t${10}\t${20}
    j4\t${10}\t${20}
    j5\t${10}\t${20}
    j6\t${10}\t${20}
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.curves.size).toBe(0);

    const pump1 = getByLabel(hydraulicModel.assets, "pu1") as Pump;
    expect(pump1.speed).toEqual(0.8);
    expect(pump1.definitionType).toEqual("power");
    expect(pump1.power).toEqual(10);

    const pump2 = getByLabel(hydraulicModel.assets, "pu2") as Pump;
    expect(pump2.speed).toEqual(0.4);
    expect(pump2.definitionType).toEqual("power");
    expect(pump2.power).toEqual(22);

    const pump3 = getByLabel(hydraulicModel.assets, "pu3") as Pump;
    expect(pump3.speed).toEqual(20);
    expect(pump3.definitionType).toEqual("curve");
    expect(pump3.curve).toEqual([{ x: 10, y: 20 }]);

    const pump4 = getByLabel(hydraulicModel.assets, "pu4") as Pump;
    expect(pump4.speed).toEqual(0.2);
    expect(pump4.definitionType).toEqual("curve");
    expect(pump4.curve).toEqual([{ x: 10, y: 20 }]);

    const pump5 = getByLabel(hydraulicModel.assets, "pu5") as Pump;
    expect(pump5.speed).toEqual(0.9);
    expect(pump5.definitionType).toEqual("power");
    expect(pump5.power).toEqual(10);
  });
});
