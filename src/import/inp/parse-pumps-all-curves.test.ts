import { Junction, Pump, Reservoir } from "src/hydraulic-model";
import { parseInpWithAllCurves } from "./parse-inp-with-all-curves";
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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

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

  it("head curve definition", () => {
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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    expect(hydraulicModel.curves.size).toBe(1);
    const curveId = hydraulicModel.labelManager.getIdByLabel(
      curveLabel,
      "curve",
    )!;
    const curve = hydraulicModel.curves.get(curveId)!;
    expect(curve.label).toEqual(curveLabel);
    expect(curve.points).toEqual([{ x: designFlow, y: designHead }]);
    expect(curve.assetIds.size).toBe(1);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.definitionType).toEqual("curveId");
    expect(pump.curveId).toEqual(curveId);
    expect(curve.assetIds.has(pump.id)).toBe(true);
  });

  it("power based definition", () => {
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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("power");
    expect(pump.power).toEqual(power);
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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("off");
    expect(pump.speed).toEqual(0.8);
  });

  it("is case insensitive", () => {
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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel("cu_1", "curve")!;
    const curve = hydraulicModel.curves.get(curveId)!;
    expect(curve.label).toEqual("CU_1");

    const pump1 = getByLabel(hydraulicModel.assets, "pu1") as Pump;
    expect(pump1.speed).toEqual(0.8);
    expect(pump1.definitionType).toEqual("power");
    expect(pump1.power).toEqual(10);

    const pump2 = getByLabel(hydraulicModel.assets, "pu2") as Pump;
    expect(pump2.definitionType).toEqual("curveId");
    expect(pump2.initialStatus).toEqual("off");
    expect(pump2.curveId).toEqual(curveId);
  });

  describe("curves", () => {
    it("correctly links same curve to multiple pumps", () => {
      const anyNumber = 10;
      const curveLabel = "CU_1";
      const inp = `
      [JUNCTIONS]
      j1\t${anyNumber}
      j2\t${anyNumber}
      j3\t${anyNumber}
      [PUMPS]
      pu1\tj1\tj2\tSPEED 20\tHEAD ${curveLabel}
      pu2\tj2\tj3\tHEAD ${curveLabel}\tSPEED 0.2

      [CURVES]
      ${curveLabel}\t10\t20

      [PATTERNS]
      PAT_1 0.9

      [COORDINATES]
      j1\t${10}\t${20}
      j2\t${10}\t${20}
      j3\t${10}\t${20}
      `;

      const { hydraulicModel } = parseInpWithAllCurves(inp);

      expect(hydraulicModel.curves.size).toBe(1);
      const curveId = hydraulicModel.labelManager.getIdByLabel(
        "CU_1",
        "curve",
      )!;
      const curve = hydraulicModel.curves.get(curveId)!;
      expect(curve.label).toEqual("CU_1");
      expect(curve.points).toEqual([{ x: 10, y: 20 }]);
      expect(curve.assetIds.size).toBe(2);

      const pump1 = getByLabel(hydraulicModel.assets, "pu1") as Pump;
      expect(pump1.speed).toEqual(20);
      expect(pump1.definitionType).toEqual("curveId");
      expect(pump1.curveId).toEqual(curveId);
      expect(curve.assetIds.has(pump1.id)).toBe(true);

      const pump2 = getByLabel(hydraulicModel.assets, "pu2") as Pump;
      expect(pump2.speed).toEqual(0.2);
      expect(pump2.definitionType).toEqual("curveId");
      expect(pump2.curveId).toEqual(curveId);
      expect(curve.assetIds.has(pump2.id)).toBe(true);
    });

    it("3-point curve", () => {
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

      const { hydraulicModel } = parseInpWithAllCurves(inp);

      expect(hydraulicModel.curves.size).toBe(1);
      const curveId = hydraulicModel.labelManager.getIdByLabel(
        curveLabel,
        "curve",
      )!;
      const curve = hydraulicModel.curves.get(curveId)!;
      expect(curve.label).toEqual(curveLabel);
      expect(curve.points).toEqual([
        { x: 0, y: 300 },
        { x: 100, y: 250 },
        { x: 200, y: 150 },
      ]);
      expect(curve.assetIds.size).toBe(1);
      const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
      expect(pump.initialStatus).toEqual("on");
      expect(pump.definitionType).toEqual("curveId");
      expect(pump.curveId).toEqual(curveId);
      expect(curve.assetIds.has(pump.id)).toBe(true);
    });

    it("multi-point curve", () => {
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
      ${curveLabel}\t300\t50
      `;

      const { hydraulicModel } = parseInpWithAllCurves(inp);

      expect(hydraulicModel.curves.size).toBe(1);
      const curveId = hydraulicModel.labelManager.getIdByLabel(
        curveLabel,
        "curve",
      )!;
      const curve = hydraulicModel.curves.get(curveId)!;
      expect(curve.label).toEqual(curveLabel);
      expect(curve.points).toEqual([
        { x: 0, y: 300 },
        { x: 100, y: 250 },
        { x: 200, y: 150 },
        { x: 300, y: 50 },
      ]);
      expect(curve.assetIds.size).toBe(1);
      const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
      expect(pump.initialStatus).toEqual("on");
      expect(pump.definitionType).toEqual("curveId");
      expect(pump.curveId).toEqual(curveId);
      expect(curve.assetIds.has(pump.id)).toBe(true);
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

      const { hydraulicModel, issues } = parseInpWithAllCurves(inp);

      const curveId = hydraulicModel.labelManager.getIdByLabel(
        curveLabel,
        "curve",
      )!;
      const curve = hydraulicModel.curves.get(curveId)!;
      expect(curve.points).toEqual([{ x: 200, y: 300 }]);
      expect(issues?.hasPumpCurves).toBe(1);

      const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
      expect(pump.definitionType).toEqual("curveId");
      expect(pump.curveId).toEqual(curveId);
    });

    it("falls back to design-point mode when 3-point curve first flow value is greater than 0", () => {
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
        ${curveLabel}\t50\t300
        ${curveLabel}\t100\t250
        ${curveLabel}\t200\t150
        `;

      const { hydraulicModel, issues } = parseInpWithAllCurves(inp);

      const curveId = hydraulicModel.labelManager.getIdByLabel(
        curveLabel,
        "curve",
      )!;
      expect(curveId).toBeDefined();
      const curve = hydraulicModel.curves.get(curveId)!;
      expect(curve.points).toEqual([{ x: 100, y: 250 }]);
      expect(issues?.hasPumpCurves).toBe(1);

      const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
      expect(pump.definitionType).toEqual("curveId");
      expect(pump.curveId).toEqual(curveId);
    });

    it("falls back to design-point mode when curve has non-ascending flow values", () => {
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

      const { hydraulicModel, issues } = parseInpWithAllCurves(inp);

      const curveId = hydraulicModel.labelManager.getIdByLabel(
        curveLabel,
        "curve",
      )!;
      const curve = hydraulicModel.curves.get(curveId)!;
      expect(curve.points).toEqual([{ x: 200, y: 250 }]);
      expect(issues?.hasPumpCurves).toBe(1);

      const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
      expect(pump.definitionType).toEqual("curveId");
      expect(pump.curveId).toEqual(curveId);
    });
  });

  it("handles pump status and speed with standard curves", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const curveId = "cu1";
    const anyNumber = 10;
    const speed = 0.85;

    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tHEAD ${curveId}\tSPEED ${speed}

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveId}\t0\t300
    ${curveId}\t100\t250
    ${curveId}\t200\t150
    `;

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("curveId");
    expect(pump.speed).toEqual(speed);
    expect(pump.initialStatus).toEqual("on");
  });
});
