import { Pump } from "src/hydraulic-model";
import { parseInpWithPumpCurves } from "./parse-inp-with-pump-curves";
import { getByLabel } from "src/__helpers__/asset-queries";

describe("parse pumps", () => {
  it("parses a pump with 1-point curve as design-point type", () => {
    const reservoirId = "r1";
    const junctionId = "j1";
    const pumpId = "pu1";
    const curveId = "cu1";
    const anyNumber = 10;
    const designFlow = 100;
    const designHead = 200;

    const inp = `
    [RESERVOIRS]
    ${reservoirId}\t${anyNumber}
    [JUNCTIONS]
    ${junctionId}\t${anyNumber}
    [PUMPS]
    ${pumpId}\t${reservoirId}\t${junctionId}\tHEAD ${curveId}

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveId}\t${designFlow}\t${designHead}
    `;

    const { hydraulicModel } = parseInpWithPumpCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.definitionType).toEqual("design-point");
    expect(pump.curveId).toEqual(curveId.toUpperCase());

    expect(hydraulicModel.curves.has(curveId.toUpperCase())).toBe(true);
    const curve = hydraulicModel.curves.get(curveId.toUpperCase());
    expect(curve!.points.length).toEqual(1);
    expect(curve!.points[0].x).toEqual(designFlow);
    expect(curve!.points[0].y).toEqual(designHead);
  });

  it("parses a pump with 3-point curve as standard type", () => {
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

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveId}\t0\t300
    ${curveId}\t100\t250
    ${curveId}\t200\t150
    `;

    const { hydraulicModel } = parseInpWithPumpCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.initialStatus).toEqual("on");
    expect(pump.definitionType).toEqual("standard");
    expect(pump.curveId).toEqual(curveId.toUpperCase());

    expect(hydraulicModel.curves.has(curveId.toUpperCase())).toBe(true);
    const curve = hydraulicModel.curves.get(curveId.toUpperCase());
    expect(curve?.points).toHaveLength(3);
    expect(curve!.points).toEqual([
      { x: 0, y: 300 },
      { x: 100, y: 250 },
      { x: 200, y: 150 },
    ]);
  });

  it("falls back to power mode when curve is invalid (2 points)", () => {
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

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveId}\t100\t200
    ${curveId}\t200\t300
    `;

    const { hydraulicModel, issues } = parseInpWithPumpCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("power");
    expect(pump.power).toEqual(20); // Default fallback power

    expect(issues?.unsupportedSections?.has("[CURVES]")).toBe(true);
  });

  it("falls back to power mode when 3-point curve has invalid flow values", () => {
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

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveId}\t50\t300
    ${curveId}\t100\t250
    ${curveId}\t200\t150
    `;

    const { hydraulicModel, issues } = parseInpWithPumpCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("power");
    expect(pump.power).toEqual(20); // Default fallback power

    expect(issues?.unsupportedSections?.has("[CURVES]")).toBe(true);
  });

  it("falls back to power mode when 3-point curve has non-ascending flow values", () => {
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

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40

    [CURVES]
    ${curveId}\t0\t300
    ${curveId}\t200\t250
    ${curveId}\t100\t150
    `;

    const { hydraulicModel, issues } = parseInpWithPumpCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("power");
    expect(pump.power).toEqual(20); // Default fallback power

    expect(issues?.unsupportedSections?.has("[CURVES]")).toBe(true);
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

    const { hydraulicModel } = parseInpWithPumpCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("power");
    expect(pump.power).toEqual(power);
    expect(pump.curveId).toBeUndefined();
  });

  it("handles multiple pumps with different curve types", () => {
    const anyNumber = 10;

    const inp = `
    [JUNCTIONS]
    j1\t${anyNumber}
    j2\t${anyNumber}
    j3\t${anyNumber}
    j4\t${anyNumber}

    [PUMPS]
    pu1\tj1\tj2\tPOWER 50
    pu2\tj2\tj3\tHEAD cu1
    pu3\tj3\tj4\tHEAD cu2

    [COORDINATES]
    j1\t10\t20
    j2\t20\t20
    j3\t30\t20
    j4\t40\t20

    [CURVES]
    cu1\t100\t200
    cu2\t0\t300
    cu2\t100\t250
    cu2\t200\t150
    `;

    const { hydraulicModel } = parseInpWithPumpCurves(inp);

    const pump1 = getByLabel(hydraulicModel.assets, "pu1") as Pump;
    expect(pump1.definitionType).toEqual("power");
    expect(pump1.power).toEqual(50);

    const pump2 = getByLabel(hydraulicModel.assets, "pu2") as Pump;
    expect(pump2.definitionType).toEqual("design-point");
    expect(pump2.curveId).toEqual("CU1");

    const pump3 = getByLabel(hydraulicModel.assets, "pu3") as Pump;
    expect(pump3.definitionType).toEqual("standard");
    expect(pump3.curveId).toEqual("CU2");

    expect(hydraulicModel.curves.size).toEqual(2);
    expect(hydraulicModel.curves.has("CU1")).toBe(true);
    expect(hydraulicModel.curves.has("CU2")).toBe(true);
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

    const { hydraulicModel } = parseInpWithPumpCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("standard");
    expect(pump.speed).toEqual(speed);
    expect(pump.initialStatus).toEqual("on");
  });

  it("falls back to power mode when curve is missing", () => {
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

    [COORDINATES]
    ${reservoirId}\t10\t20
    ${junctionId}\t30\t40
    `;

    const { hydraulicModel } = parseInpWithPumpCurves(inp);

    const pump = getByLabel(hydraulicModel.assets, pumpId) as Pump;
    expect(pump.definitionType).toEqual("power");
    expect(pump.power).toEqual(20); // Default fallback power
  });
});
