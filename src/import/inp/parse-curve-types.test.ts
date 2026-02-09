import { parseInpWithAllCurves } from "./parse-inp-with-all-curves";

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
    cu1\t100\t200
    ${coords(["j1", "j2"])}
    `;

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel("cu1", "curve")!;
    const curve = hydraulicModel.curves.get(curveId)!;
    expect(curve.type).toEqual("pump");
  });

  it("sets type 'volume' for curves used by a tank volume curve", () => {
    const inp = `
    [TANKS]
    T1\t100\t15\t5\t25\t120\t0\tVC1
    [CURVES]
    VC1\t0\t0
    VC1\t10\t500
    VC1\t20\t1500
    ${coords(["T1"])}
    `;

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel("VC1", "curve")!;
    const curve = hydraulicModel.curves.get(curveId)!;
    expect(curve.type).toEqual("volume");
  });

  it("sets type 'valve' for PCV valve characteristic curves", () => {
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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel(
      "PCV_CURVE",
      "curve",
    )!;
    const curve = hydraulicModel.curves.get(curveId)!;
    expect(curve.type).toEqual("valve");
  });

  it("sets type 'headloss' for GPV headloss curves", () => {
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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel(
      "HL_CURVE",
      "curve",
    )!;
    const curve = hydraulicModel.curves.get(curveId)!;
    expect(curve.type).toEqual("headloss");
  });

  it("sets type 'efficiency' for ENERGY pump efficiency curves", () => {
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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel("EFF1", "curve")!;
    const curve = hydraulicModel.curves.get(curveId)!;
    expect(curve.type).toEqual("efficiency");
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

    const { hydraulicModel } = parseInpWithAllCurves(inp);

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

    const { hydraulicModel, issues } = parseInpWithAllCurves(inp);

    const cu1Id = hydraulicModel.labelManager.getIdByLabel("cu1", "curve")!;
    const cu2Id = hydraulicModel.labelManager.getIdByLabel("cu2", "curve")!;
    expect(hydraulicModel.curves.get(cu1Id)!.type).toEqual("pump");
    expect(hydraulicModel.curves.get(cu2Id)!.type).toBeUndefined();
    expect(issues?.hasUnusedCurves).toBe(2);
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

    const { issues } = parseInpWithAllCurves(inp);

    expect(issues?.hasUnusedCurves).toBeUndefined();
  });

  it("falls back to default when pump references an invalid curve", () => {
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

    const { hydraulicModel, issues } = parseInpWithAllCurves(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel(
      "bad_curve",
      "curve",
    )!;
    const curve = hydraulicModel.curves.get(curveId)!;
    expect(curve.type).toBeUndefined();
    expect(issues?.hasPumpCurves).toBe(1);
    expect(issues?.hasUnusedCurves).toBe(1);
  });
});
