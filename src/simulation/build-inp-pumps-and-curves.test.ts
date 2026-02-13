import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "./build-inp";

describe("build inp with pumps and curves", () => {
  it("adds pumps with a local curve", () => {
    const IDS = { NODE1: 1, NODE2: 2, PUMP1: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.NODE1, { label: "J1" })
      .aJunction(IDS.NODE2, { label: "J2" })
      .aPump(IDS.PUMP1, {
        startNodeId: IDS.NODE1,
        endNodeId: IDS.NODE2,
        label: "PU1",
        initialStatus: "on",
        definitionType: "curve",
        curve: [
          { x: 0, y: 60 },
          { x: 20, y: 40 },
          { x: 40, y: 0 },
        ],
        speed: 0.8,
      })
      .build();

    const inp = buildInp(hydraulicModel, { labelIds: true });

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("PU1\tJ1\tJ2\tHEAD PU1\tSPEED 0.8");
    // Pump curve definition
    expect(inp).toContain("PU1\t0\t60");
    expect(inp).toContain("PU1\t20\t40");
    expect(inp).toContain("PU1\t40\t0");
  });

  it("adds pumps with power definition", () => {
    const IDS = { NODE1: 1, NODE2: 2, PUMP1: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.NODE1)
      .aNode(IDS.NODE2)
      .aPump(IDS.PUMP1, {
        startNodeId: IDS.NODE1,
        endNodeId: IDS.NODE2,
        initialStatus: "on",
        definitionType: "power",
        speed: 0.7,
        power: 100,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("4\t1\t2\tPOWER 100\tSPEED 0.7");
  });

  it("does not include status for pumps when speed not 1", () => {
    const IDS = {
      NODE1: 1,
      NODE2: 2,
      NODE3: 3,
      NODE4: 4,
      PUMP1: 5,
      PUMP2: 6,
      PUMP3: 7,
    };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(IDS.NODE1)
      .aNode(IDS.NODE2)
      .aNode(IDS.NODE3)
      .aNode(IDS.NODE4)
      .aPump(IDS.PUMP1, {
        startNodeId: IDS.NODE1,
        endNodeId: IDS.NODE2,
        initialStatus: "on",
        definitionType: "power",
        speed: 0.7,
        power: 10,
      })
      .aPump(IDS.PUMP2, {
        startNodeId: IDS.NODE2,
        endNodeId: IDS.NODE3,
        initialStatus: "off",
        definitionType: "power",
        speed: 0.8,
        power: 20,
      })
      .aPump(IDS.PUMP3, {
        startNodeId: IDS.NODE3,
        endNodeId: IDS.NODE4,
        initialStatus: "on",
        definitionType: "power",
        speed: 1,
        power: 30,
      })
      .build();

    const inp = buildInp(hydraulicModel);

    expect(inp).toContain("[PUMPS]");
    expect(inp).toContain("5\t1\t2\tPOWER 10\tSPEED 0.7");
    expect(inp).toContain("6\t2\t3\tPOWER 20\tSPEED 0.8");
    expect(inp).toContain("7\t3\t4\tPOWER 30\tSPEED 1");
    expect(inp).toContain("[STATUS]");
    expect(inp).toContain("5\t0.7");
    expect(inp).toContain("6\tClosed");
    expect(inp).toContain("7\tOpen");
  });

  describe("curves", () => {
    it("includes all curves by default", () => {
      const IDS = { CURVE1: 1, CURVE2: 2, CURVE3: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPumpCurve({
          id: IDS.CURVE1,
          label: "design.point",
          points: [{ x: 20, y: 40 }],
        })
        .aPumpCurve({
          id: IDS.CURVE2,
          label: "standard",
          points: [
            { x: 0, y: 100 },
            { x: 20, y: 50 },
            { x: 40, y: 0 },
          ],
        })
        .aPumpCurve({
          id: IDS.CURVE3,
          label: "custom",
          points: [
            { x: 0, y: 10 },
            { x: 1, y: 9 },
            { x: 2, y: 8 },
            { x: 3, y: 7 },
          ],
        })
        .build();

      const inp = buildInp(hydraulicModel);

      expect(inp).toContain("[CURVES]");
      expect(inp).toContain("design.point\t20\t40");
      expect(inp).toContain("standard\t0\t100");
      expect(inp).toContain("standard\t20\t50");
      expect(inp).toContain("standard\t40\t0");
      expect(inp).toContain("custom\t0\t10");
      expect(inp).toContain("custom\t1\t9");
      expect(inp).toContain("custom\t2\t8");
      expect(inp).toContain("custom\t3\t7");
    });

    it("includes only used curves when usedCurves is true", () => {
      const IDS = { J1: 1, J2: 2, PUMP1: 3, UNUSED_CURVE: 10 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunction(IDS.J2, { elevation: 20 })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          definitionType: "curveId",
          curveId: IDS.PUMP1,
        })
        .aPumpCurve({
          id: IDS.PUMP1,
          label: "used",
          points: [{ x: 20, y: 40 }],
        })
        .aPumpCurve({
          id: IDS.UNUSED_CURVE,
          label: "unused",
          points: [{ x: 50, y: 100 }],
        })
        .build();

      const inp = buildInp(hydraulicModel, { usedCurves: true });

      expect(inp).toContain("[CURVES]");
      expect(inp).toContain("used\t20\t40");
      expect(inp).not.toContain("unused");
    });

    it("avoids ID collision between local and global curves", () => {
      const IDS = { NODE1: 1, NODE2: 2, PUMP1: 4, PUMP2: 5, CURVE: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.NODE1, { label: "J1" })
        .aJunction(IDS.NODE2, { label: "J2" })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.NODE1,
          endNodeId: IDS.NODE2,
          label: "PU1",
          initialStatus: "on",
          definitionType: "curve",
          curve: [{ x: 20, y: 40 }],
          speed: 0.8,
        })
        .aPump(IDS.PUMP2, {
          startNodeId: IDS.NODE1,
          endNodeId: IDS.NODE2,
          label: "PU2",
          initialStatus: "on",
          definitionType: "curveId",
          curveId: IDS.CURVE,
          speed: 0.8,
        })
        .aPumpCurve({
          id: IDS.CURVE,
          label: "PU1",
          points: [{ x: 40, y: 60 }],
        })
        .build();

      const inp = buildInp(hydraulicModel, { labelIds: true });

      expect(inp).toContain("[PUMPS]");
      expect(inp).toContain("PU1\tJ1\tJ2\tHEAD PU1\tSPEED 0.8");
      expect(inp).toContain("PU2\tJ1\tJ2\tHEAD PU1.1\tSPEED 0.8");
      // Pump curve definition
      expect(inp).toContain("PU1\t20\t40");
      expect(inp).toContain("PU1.1\t40\t60");
    });

    it("keeps curve ID when curve is used by multiple pumps", () => {
      const IDS = { NODE1: 1, NODE2: 2, PUMP1: 4, PUMP2: 5, CURVE: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.NODE1, { label: "J1" })
        .aJunction(IDS.NODE2, { label: "J2" })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.NODE1,
          endNodeId: IDS.NODE2,
          label: "PU1",
          initialStatus: "on",
          definitionType: "curveId",
          curveId: IDS.CURVE,
          speed: 0.8,
        })
        .aPump(IDS.PUMP2, {
          startNodeId: IDS.NODE1,
          endNodeId: IDS.NODE2,
          label: "PU2",
          initialStatus: "on",
          definitionType: "curveId",
          curveId: IDS.CURVE,
          speed: 0.8,
        })
        .aPumpCurve({
          id: IDS.CURVE,
          label: "CURVE",
          points: [{ x: 40, y: 60 }],
        })
        .build();

      const inp = buildInp(hydraulicModel, { labelIds: true });

      expect(inp).toContain("[PUMPS]");
      expect(inp).toContain("PU1\tJ1\tJ2\tHEAD CURVE\tSPEED 0.8");
      expect(inp).toContain("PU2\tJ1\tJ2\tHEAD CURVE\tSPEED 0.8");
      // Pump curve definition
      expect(inp).toContain("CURVE\t40\t60");
    });
  });
});
