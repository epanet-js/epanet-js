import { getByLabel } from "src/__helpers__/asset-queries";
import { parseInp } from "./parse-inp";
import { Pump } from "src/hydraulic-model";

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

  it("sets type 'volume' for curves used in tanks", () => {
    const inp = `
    [TANKS]
    T1\t100\t15\t5\t25\t120\t0\tVC1
    [CURVES]
    VC1\t0\t0
    VC1\t10\t500
    VC1\t20\t1500
    ${coords(["T1"])}
    `;

    const { hydraulicModel } = parseInp(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel("VC1", "curve");
    expect(curveId).toBeDefined();
    const curve = hydraulicModel.curves.get(curveId!)!;
    expect(curve.type).toBe("volume");
  });

  it("sets 'valve curve type for curve used by PCV valve", () => {
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

    const { hydraulicModel } = parseInp(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel(
      "PCV_CURVE",
      "curve",
    );
    expect(curveId).toBeDefined();
    const curve = hydraulicModel.curves.get(curveId!)!;
    expect(curve.type).toBe("valve");
  });

  it("sets 'headloss' type for curve used by GPV valve", () => {
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

    const { hydraulicModel } = parseInp(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel(
      "HL_CURVE",
      "curve",
    );
    expect(curveId).toBeDefined();
    const curve = hydraulicModel.curves.get(curveId!)!;
    expect(curve.type).toBe("headloss");
  });

  it("sets 'efficiency' type for curves used by a pump EFFICIENCY definition ", () => {
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

    const { hydraulicModel } = parseInp(inp);

    const curveId = hydraulicModel.labelManager.getIdByLabel("EFF1", "curve");
    expect(curveId).toBeDefined();
    const curve = hydraulicModel.curves.get(curveId!)!;
    expect(curve.type).toBe("efficiency");
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

  it("keeps invalid curve as library reference", () => {
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

    const { hydraulicModel } = parseInp(inp);
    const curveId = hydraulicModel.labelManager.getIdByLabel("cu1", "curve");
    expect(curveId).toBeDefined();
    const curve = hydraulicModel.curves.get(curveId!);
    expect(curve).toBeDefined();
    expect(curve!.type).toBe("pump");
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

    const { hydraulicModel } = parseInp(inp);
    expect(hydraulicModel.curves.size).toBe(1);
    const curveId = hydraulicModel.labelManager.getIdByLabel("cu1", "curve")!;
    expect(hydraulicModel.curves.get(curveId)!.type).toBeUndefined();
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

    const { hydraulicModel } = parseInp(inp);
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

    const { hydraulicModel } = parseInp(inp);
    expect(
      hydraulicModel.labelManager.getIdByLabel("cu1", "curve"),
    ).toBeDefined();
    expect(
      hydraulicModel.labelManager.getIdByLabel("cu2", "curve"),
    ).toBeDefined();
    const cu1Id = hydraulicModel.labelManager.getIdByLabel("cu1", "curve")!;
    const cu2Id = hydraulicModel.labelManager.getIdByLabel("cu2", "curve")!;
    expect(hydraulicModel.curves.get(cu1Id)!.type).toBe("pump");
    expect(hydraulicModel.curves.get(cu2Id)!.type).toBeUndefined();
  });
});

describe("curve duplication for multi-type usage", () => {
  it("duplicates curve used as both volume and pump", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [TANKS]
    T1\t100\t15\t5\t25\t120\t0\tshared
    [PUMPS]
    pu1\tj1\tj2\tHEAD shared
    [CURVES]
    shared\t0\t200
    shared\t100\t0
    ${coords(["j1", "j2", "T1"])}
    `;

    const { hydraulicModel } = parseInp(inp);
    const curves = [...hydraulicModel.curves.values()];

    // The pump curve is a duplicate with a suffixed label
    expect(curves).toHaveLength(2);
    expect(curves[0].type).toBe("volume");
    expect(curves[0].label).toBe("shared");
    expect(curves[0].points).toEqual([
      { x: 0, y: 200 },
      { x: 100, y: 0 },
    ]);
    expect(curves[1].type).toBe("pump");
    expect(curves[1].label).toMatch(/^shared_\d+$/);
    expect(curves[1].points).toEqual([
      { x: 0, y: 200 },
      { x: 100, y: 0 },
    ]);

    // The pump references the duplicate curve
    const pump = getByLabel(hydraulicModel.assets, "pu1") as Pump;
    expect(pump.curveId).toBe(curves[1].id);
  });

  it("duplicates curve used as both pump and efficiency", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    [PUMPS]
    pu1\tj1\tj2\tHEAD shared
    [ENERGY]
    PUMP\tpu1\tEFFICIENCY\tshared
    [CURVES]
    shared\t0\t200
    shared\t100\t0
    ${coords(["j1", "j2"])}
    `;

    const { hydraulicModel } = parseInp(inp);
    const curves = [...hydraulicModel.curves.values()];

    // Pump curve stays with original label
    expect(curves).toHaveLength(2);
    expect(curves[0].type).toBe("pump");
    expect(curves[0].label).toBe("shared");
    expect(curves[1].type).toBe("efficiency");
    expect(curves[1].label).toMatch(/^shared_\d+$/);
  });

  it("does not duplicate when same curve is used by multiple pumps for the same type", () => {
    const inp = `
    [JUNCTIONS]
    j1\t10
    j2\t10
    j3\t10
    [PUMPS]
    pu1\tj1\tj2\tHEAD shared
    pu2\tj2\tj3\tHEAD shared
    [CURVES]
    shared\t0\t200
    shared\t100\t0
    ${coords(["j1", "j2", "j3"])}
    `;

    const { hydraulicModel } = parseInp(inp);
    const curves = [...hydraulicModel.curves.values()];

    // Only one curve, shared by both pumps
    expect(curves).toHaveLength(1);
    expect(curves[0].type).toBe("pump");
    expect(curves[0].label).toBe("shared");

    // Both pumps reference the same curve
    const pu1 = getByLabel(hydraulicModel.assets, "pu1") as Pump;
    const pu2 = getByLabel(hydraulicModel.assets, "pu2") as Pump;
    expect(pu1.curveId).toBe(pu2.curveId);
  });
});
