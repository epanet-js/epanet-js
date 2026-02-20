import { Pump } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { parseInpWithPatterns } from "./parse-inp-with-patterns";
import { getByLabel } from "src/__helpers__/asset-queries";

const coords = (ids: string[]) =>
  `[COORDINATES]\n` + ids.map((id) => `${id}\t10\t20`).join("\n");

describe("curve type inference", () => {
  it("sets type 'pump' for curves used by a pump HEAD definition", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [PUMPS]
    pu1\tj1\tj2\tHEAD cu1
    [CURVES]
    cu1\t0\t200
    cu1\t100\t0
    ${coords(["j1", "j2"])}
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.curves.size).toBe(1);
    const curveId = hydraulicModel.labelManager.getIdByLabel("cu1", "curve")!;
    const curve = hydraulicModel.curves.get(curveId)!;
    expect(curve.type).toEqual("pump");
  });

  it("excludes volume curves from hydraulicModel", () => {
    const inp = `
    [TANKS]
    T1\t100\t15\t5\t25\t120\t0\tVC1
    [CURVES]
    VC1\t0\t0
    VC1\t10\t500
    VC1\t20\t1500
    ${coords(["T1"])}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    expect(
      hydraulicModel.labelManager.getIdByLabel("VC1", "curve"),
    ).toBeUndefined();
    expect(hydraulicModel.curves.size).toBe(0);
    expect(issues?.hasUnusedCurves).toBeUndefined();
  });

  it("excludes valve curves from hydraulicModel", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [VALVES]
    v1\tj1\tj2\t100\tPCV\t50\t0\tPCV_CURVE
    [CURVES]
    PCV_CURVE\t0\t0
    PCV_CURVE\t50\t60
    PCV_CURVE\t100\t100
    ${coords(["j1", "j2"])}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    expect(
      hydraulicModel.labelManager.getIdByLabel("PCV_CURVE", "curve"),
    ).toBeUndefined();
    expect(hydraulicModel.curves.size).toBe(0);
    expect(issues?.hasUnusedCurves).toBeUndefined();
  });

  it("excludes headloss curves from hydraulicModel", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [VALVES]
    v1\tj1\tj2\t100\tGPV\tHL_CURVE\t0
    [CURVES]
    HL_CURVE\t0\t0
    HL_CURVE\t100\t10
    HL_CURVE\t200\t40
    ${coords(["j1", "j2"])}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    expect(
      hydraulicModel.labelManager.getIdByLabel("HL_CURVE", "curve"),
    ).toBeUndefined();
    expect(hydraulicModel.curves.size).toBe(0);
    expect(issues?.hasUnusedCurves).toBeUndefined();
  });

  it("excludes efficiency curves from hydraulicModel", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [PUMPS]
    pu1\tj1\tj2\tPOWER 10
    [ENERGY]
    PUMP\tpu1\tEFFICIENCY\tEFF1
    [CURVES]
    EFF1\t0\t50
    EFF1\t50\t80
    EFF1\t100\t60
    ${coords(["j1", "j2"])}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    expect(
      hydraulicModel.labelManager.getIdByLabel("EFF1", "curve"),
    ).toBeUndefined();
    expect(hydraulicModel.curves.size).toBe(0);
    expect(issues?.hasUnusedCurves).toBeUndefined();
  });

  it("ignores numeric ENERGY efficiency values (not curves)", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [PUMPS]
    pu1\tj1\tj2\tPOWER 10
    [ENERGY]
    PUMP\tpu1\tEFFICIENCY\t85
    ${coords(["j1", "j2"])}
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.curves.size).toBe(0);
  });

  it("reports unused curves", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [PUMPS]
    pu1\tj1\tj2\tHEAD cu1
    [CURVES]
    cu1\t100\t200
    cu2\t50\t100
    cu3\t0\t0
    cu3\t10\t500
    ${coords(["j1", "j2"])}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    expect(hydraulicModel.curves.size).toBe(0);
    const pump = getByLabel(hydraulicModel.assets, "pu1") as Pump;
    expect(pump.definitionType).toEqual("curve");
    expect(pump.curve).toEqual([{ x: 100, y: 200 }]);
    expect(
      hydraulicModel.labelManager.getIdByLabel("cu2", "curve"),
    ).toBeUndefined();
    expect(issues?.hasUnusedCurves).toBe(2);
  });

  it("only includes multi-point or shared pump curves in hydraulicModel.curves", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [TANKS]
    T1\t100\t15\t5\t25\t120\t0\tVC1
    [PUMPS]
    pu1\tj1\tj2\tHEAD cu1
    [CURVES]
    cu1\t100\t200
    VC1\t0\t0
    VC1\t10\t500
    unused1\t50\t100
    ${coords(["j1", "j2", "T1"])}
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.curves.size).toBe(0);
    const pump = getByLabel(hydraulicModel.assets, "pu1") as Pump;
    expect(pump.definitionType).toEqual("curve");
    expect(pump.curve).toEqual([{ x: 100, y: 200 }]);
    expect(
      hydraulicModel.labelManager.getIdByLabel("VC1", "curve"),
    ).toBeUndefined();
    expect(
      hydraulicModel.labelManager.getIdByLabel("unused1", "curve"),
    ).toBeUndefined();
  });

  it("does not report unused curves when all curves are used", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [PUMPS]
    pu1\tj1\tj2\tHEAD cu1
    [CURVES]
    cu1\t100\t200
    ${coords(["j1", "j2"])}
    `;

    const { issues } = parseInp(inp);

    expect(issues?.hasUnusedCurves).toBeUndefined();
  });

  it("keeps invalid curve as library reference when pump references it", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [PUMPS]
    pu1\tj1\tj2\tHEAD bad_curve
    [CURVES]
    bad_curve\t100\t200
    bad_curve\t50\t300
    ${coords(["j1", "j2"])}
    `;

    const { hydraulicModel, issues } = parseInp(inp);

    expect(
      hydraulicModel.labelManager.getIdByLabel("bad_curve", "curve"),
    ).toBeDefined();
    expect(issues?.hasInvalidPumpCurves).toBe(1);
    expect(issues?.hasUnusedCurves).toBeUndefined();
  });
});

describe("comment-based curve type fallback", () => {
  it("assigns pump type from comment for unused curve", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [CURVES]
    ;PUMP:
    cu1\t0\t200
    cu1\t100\t150
    cu1\t200\t0
    ${coords(["j1", "j2"])}
    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const curveId = hydraulicModel.labelManager.getIdByLabel("cu1", "curve");
    expect(curveId).toBeDefined();
    const curve = hydraulicModel.curves.get(curveId!);
    expect(curve).toBeDefined();
    expect(curve!.type).toBe("pump");
  });

  it("does not count curve as unused when type from comment", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [CURVES]
    ;PUMP:
    cu1\t0\t200
    cu1\t100\t150
    cu1\t200\t0
    ${coords(["j1", "j2"])}
    [END]
    `;

    const { issues } = parseInpWithPatterns(inp);
    expect(issues?.hasUnusedCurves).toBeUndefined();
  });

  it("ignores comment with multiple keywords", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [CURVES]
    ;PUMP: Valve curve
    cu1\t0\t200
    cu1\t100\t0
    ${coords(["j1", "j2"])}
    [END]
    `;

    const { hydraulicModel, issues } = parseInpWithPatterns(inp);
    expect(hydraulicModel.curves.size).toBe(1);
    const curve = [...hydraulicModel.curves.values()][0];
    expect(curve.type).toBeUndefined();
    expect(issues?.hasUnusedCurves).toBe(1);
  });

  it("usage-based type takes priority over comment", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [PUMPS]
    pu1\tj1\tj2\tHEAD cu1
    [CURVES]
    ;EFFICIENCY:
    cu1\t100\t200
    cu1\t200\t0
    ${coords(["j1", "j2"])}
    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const curveId = hydraulicModel.labelManager.getIdByLabel("cu1", "curve");
    expect(curveId).toBeDefined();
    const curve = hydraulicModel.curves.get(curveId!);
    expect(curve!.type).toBe("pump");
  });

  it("only applies comment to the curve that follows it", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [CURVES]
    ;PUMP:
    cu1\t0\t200
    cu1\t100\t150
    cu1\t200\t0
    cu2\t50\t100
    ${coords(["j1", "j2"])}
    [END]
    `;

    const { hydraulicModel, issues } = parseInpWithPatterns(inp);
    expect(
      hydraulicModel.labelManager.getIdByLabel("cu1", "curve"),
    ).toBeDefined();
    expect(
      hydraulicModel.labelManager.getIdByLabel("cu2", "curve"),
    ).toBeDefined();
    const cu2Id = hydraulicModel.labelManager.getIdByLabel("cu2", "curve")!;
    expect(hydraulicModel.curves.get(cu2Id)!.type).toBeUndefined();
    expect(issues?.hasUnusedCurves).toBe(1);
  });
});

describe("curve duplication for multi-type usage", () => {
  it("duplicates curve used for all usage types", () => {
    const inp = `
    [JUNCTIONS]
    j1    10
    j2    10

    [TANKS]
    T1    100    15    5    25    120    0    sharedCurve

    [PUMPS]
    pu1    j1    j2    HEAD    sharedCurve

    [VALVES]
    v1    j1    j2    100    GPV    sharedCurve    0

    [ENERGY]
    PUMP    pu1    EFFICIENCY    sharedCurve

    [CURVES]
    sharedCurve    50    200
    sharedCurve    200    0

    ${coords(["j1", "j2", "T1"])}
    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const curves = [...hydraulicModel.curves.values()];

    const pumpCurve = curves.find((c) => c.type === "pump");
    const volumeCurve = curves.find((c) => c.type === "volume");
    const headlossCurve = curves.find((c) => c.type === "headloss");
    const efficiencyCurve = curves.find((c) => c.type === "efficiency");

    // four distinct curves, all with the same points
    expect(curves).toHaveLength(4);
    const ids = new Set(curves.map((c) => c.id));
    expect(ids.size).toBe(4);
    for (const curve of curves) {
      expect(curve.points).toEqual([
        { x: 50, y: 200 },
        { x: 200, y: 0 },
      ]);
    }

    // each type is assigned correctly
    expect(pumpCurve).toBeDefined();
    expect(volumeCurve).toBeDefined();
    expect(headlossCurve).toBeDefined();
    expect(efficiencyCurve).toBeDefined();

    // original keeps label, duplicates get suffixed labels
    expect(volumeCurve!.label).toBe("sharedCurve");
    const duplicateLabels = new Set(
      [pumpCurve, headlossCurve, efficiencyCurve].map((c) => c!.label),
    );
    expect(duplicateLabels.size).toBe(3);
    for (const label of duplicateLabels) {
      expect(label).toMatch(/^sharedCurve_\d+$/);
    }
  });

  it("does not duplicate when same curve is used by multiple assets for the same type", () => {
    const inp = `
    [JUNCTIONS]
    j1    10
    j2    10
    j3    10

    [PUMPS]
    pu1    j1    j2    HEAD    sharedCurve
    pu2    j2    j3    HEAD    sharedCurve

    [CURVES]
    sharedCurve    50    200
    sharedCurve    200    0

    ${coords(["j1", "j2", "j3"])}
    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const curves = [...hydraulicModel.curves.values()];

    // single curve, shared between two pumps
    expect(curves).toHaveLength(1);

    const pumps = [...hydraulicModel.assets.values()].filter(
      (a) => a.type === "pump",
    ) as Pump[];
    expect(pumps[0].curveId).toBe(pumps[1].curveId);
  });
});
