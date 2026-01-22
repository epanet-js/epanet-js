import { describe, it, expect } from "vitest";
import { buildInpWithCustomerDemands } from "./build-inp-with-customer-demands";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("buildInpWithCustomerDemands", () => {
  describe("customer demands grouped by pattern", () => {
    it("includes customer demands without pattern when no pattern assigned", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, demands: [{ baseDemand: 50 }] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demands: [{ baseDemand: 25 }],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .build();

      const inp = buildInpWithCustomerDemands(hydraulicModel, {
        customerDemands: true,
      });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");
      // Customer demand without pattern should have comment marker
      expect(inp).toContain("1\t25\t;epanetjs_customers");
    });

    it("groups customer demands by pattern", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3, CP2: 4, CP3: 5 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, demands: [{ baseDemand: 50 }] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demands: [{ baseDemand: 10, patternLabel: "residential" }],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPoint(IDS.CP2, {
          demands: [{ baseDemand: 15, patternLabel: "residential" }],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPoint(IDS.CP3, {
          demands: [{ baseDemand: 20, patternLabel: "commercial" }],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aDemandPattern(100, "residential", [1, 1.2, 0.8])
        .aDemandPattern(100, "commercial", [0.5, 1.5, 1.0])
        .build();

      const inp = buildInpWithCustomerDemands(hydraulicModel, {
        customerDemands: true,
      });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");
      // Residential pattern should have total of 25 (10 + 15)
      expect(inp).toContain("1\t25\tresidential");
      // Commercial pattern should have total of 20
      expect(inp).toContain("1\t20\tcommercial");
      // Patterns should be in the PATTERNS section
      expect(inp).toContain("[PATTERNS]");
      expect(inp).toContain("residential\t1\t1.2\t0.8");
      expect(inp).toContain("commercial\t0.5\t1.5\t1");
    });

    it("marks customer demands with epanetjs_customers comment for re-import", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, demands: [{ baseDemand: 50 }] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demands: [{ baseDemand: 25, patternLabel: "residential" }],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aDemandPattern(100, "residential", [1, 1.2, 0.8])
        .build();

      const inp = buildInpWithCustomerDemands(hydraulicModel, {
        customerDemands: true,
      });

      // Customer demand should have the comment marker for re-import identification
      expect(inp).toContain("1\t25\tresidential\t;epanetjs_customers");
      // Junction's own demand should NOT have the comment marker
      expect(inp).toContain("1\t50");
      expect(inp).not.toContain("1\t50\t;epanetjs_customers");
    });

    it("handles multiple customer points on same junction without patterns", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3, CP2: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, demands: [{ baseDemand: 50 }] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demands: [{ baseDemand: 25 }],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aCustomerPoint(IDS.CP2, {
          demands: [{ baseDemand: 30 }],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .build();

      const inp = buildInpWithCustomerDemands(hydraulicModel, {
        customerDemands: true,
      });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");
      // Should aggregate to 55 without a pattern, with comment marker
      expect(inp).toContain("1\t55\t;epanetjs_customers");
    });

    it("does not include customer demands when disabled", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, demands: [{ baseDemand: 50 }] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demands: [{ baseDemand: 25 }],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .build();

      const inp = buildInpWithCustomerDemands(hydraulicModel, {
        customerDemands: false,
      });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");
      expect(inp).not.toContain("1\t25");
    });

    it("skips customer demands when they are zero", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, demands: [{ baseDemand: 50 }] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demands: [{ baseDemand: 0 }],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .build();

      const inp = buildInpWithCustomerDemands(hydraulicModel, {
        customerDemands: true,
      });

      expect(inp).toContain("[DEMANDS]");
      expect(inp).toContain("1\t50");

      const demandsSection = inp.match(/\[DEMANDS\]([\s\S]*?)\n\n/)?.[1] || "";
      expect(demandsSection).not.toContain("1\t0");
    });

    it("tracks used patterns from customer points for export", () => {
      const IDS = { J1: 1, P1: 2, CP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10 })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          demands: [{ baseDemand: 25, patternLabel: "daily_pattern" }],
          coordinates: [1, 1],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aDemandPattern(100, "daily_pattern", [0.8, 1.0, 1.2, 1.0])
        .aDemandPattern(100, "unused_pattern", [1, 1, 1])
        .build();

      const inp = buildInpWithCustomerDemands(hydraulicModel, {
        customerDemands: true,
        customerPoints: true,
      });

      // Used pattern should be in the output
      expect(inp).toContain("daily_pattern\t0.8\t1\t1.2\t1");
      // Unused pattern should NOT be in the output
      expect(inp).not.toContain("unused_pattern");
    });
  });

  describe("customer points section", () => {
    it("includes customers demands section when customer points exist", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10, coordinates: [1, 2] })
        .aJunction(IDS.J2, { elevation: 20, coordinates: [3, 4] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          demands: [
            { baseDemand: 10, patternLabel: "pat1" },
            { baseDemand: 5, patternLabel: "pat2" },
          ],
          coordinates: [1.5, 2.5],
          connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
        })
        .aDemandPattern(100, "pat1", [1, 2])
        .aDemandPattern(100, "pat2", [0.5, 1.5])
        .build();

      const inp = buildInpWithCustomerDemands(hydraulicModel, {
        customerPoints: true,
        geolocation: true,
      });

      expect(inp).toContain(";[CUSTOMERS_DEMANDS]");
      expect(inp).toContain(`;${IDS.CP1}\t10\tpat1`);
      expect(inp).toContain(`;${IDS.CP1}\t5\tpat2`);
    });
  });
});
