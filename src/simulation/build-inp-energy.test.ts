import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { SimulationSettingsBuilder } from "src/__helpers__/simulation-settings-builder";
import { buildInp } from "./build-inp";
import { presets } from "src/model-metadata/quantities-spec";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";

describe("build inp energy", () => {
  describe("per-pump energy", () => {
    it("writes efficiency curve label", () => {
      const IDS = { J1: 1, J2: 2, PUMP1: 3, EFF_CURVE: 10 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: "J1" })
        .aJunction(IDS.J2, { label: "J2" })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          label: "PU1",
          efficiencyCurveId: IDS.EFF_CURVE,
        })
        .aCurve({
          id: IDS.EFF_CURVE,
          type: "efficiency",
          label: "EFF",
          points: [
            { x: 0, y: 50 },
            { x: 100, y: 80 },
          ],
        })
        .build();

      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
        labelIds: true,
      });

      expect(inp).toContain("Pump PU1 Efficiency\tEFF");
    });

    it("writes energy price", () => {
      const IDS = { J1: 1, J2: 2, PUMP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: "J1" })
        .aJunction(IDS.J2, { label: "J2" })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          label: "PU1",
          energyPrice: 0.12,
        })
        .build();

      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
        labelIds: true,
      });

      expect(inp).toContain("Pump PU1 Price\t0.12");
    });

    it("writes energy price pattern", () => {
      const IDS = { J1: 1, J2: 2, PUMP1: 3, PAT: 20 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: "J1" })
        .aJunction(IDS.J2, { label: "J2" })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          label: "PU1",
          energyPricePatternId: IDS.PAT,
        })
        .aPattern(IDS.PAT, "EPAT", [0.8, 1.2], "energyPrice")
        .build();

      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
        labelIds: true,
      });

      expect(inp).toContain("Pump PU1 Pattern\tEPAT");
    });

    it("omits energy lines when pump has no energy properties", () => {
      const IDS = { J1: 1, J2: 2, PUMP1: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: "J1" })
        .aJunction(IDS.J2, { label: "J2" })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          label: "PU1",
        })
        .build();

      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
        labelIds: true,
      });

      expect(inp).not.toContain("Pump PU1 Efficiency");
      expect(inp).not.toContain("Pump PU1 Price");
      expect(inp).not.toContain("Pump PU1 Pattern");
    });

    it("includes efficiency curve when usedCurves is true", () => {
      const IDS = { J1: 1, J2: 2, PUMP1: 3, EFF_CURVE: 10, UNUSED_CURVE: 11 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunction(IDS.J2, { elevation: 20 })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          efficiencyCurveId: IDS.EFF_CURVE,
        })
        .aCurve({
          id: IDS.EFF_CURVE,
          type: "efficiency",
          label: "EFF",
          points: [
            { x: 0, y: 50 },
            { x: 100, y: 80 },
          ],
        })
        .aCurve({
          id: IDS.UNUSED_CURVE,
          type: "efficiency",
          label: "UNUSED_EFF",
          points: [{ x: 0, y: 60 }],
        })
        .build();

      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
        usedCurves: true,
      });

      expect(inp).toContain("EFF\t0\t50");
      expect(inp).toContain("EFF\t100\t80");
      expect(inp).not.toContain("UNUSED_EFF");
    });

    it("includes energy price pattern when usedPatterns is true", () => {
      const IDS = { J1: 1, J2: 2, PUMP1: 3, PAT: 20, UNUSED_PAT: 21 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunction(IDS.J2, { elevation: 20 })
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          energyPricePatternId: IDS.PAT,
        })
        .aPattern(IDS.PAT, "EPAT", [0.8, 1.2], "energyPrice")
        .aPattern(IDS.UNUSED_PAT, "UNUSED_PAT", [0.5, 1.5], "energyPrice")
        .build();

      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
        usedPatterns: true,
      });

      expect(inp).toContain("EPAT\t0.8\t1.2");
      expect(inp).not.toContain("UNUSED_PAT");
    });
  });

  describe("global energy settings", () => {
    it("marks global energy pattern as used when usedPatterns is true", () => {
      const IDS = { J1: 1, PAT: 20, UNUSED_PAT: 21 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { elevation: 10 })
        .aPattern(IDS.PAT, "GPAT", [0.5, 1.0, 1.5])
        .aPattern(IDS.UNUSED_PAT, "UNUSED_PAT", [1.0, 2.0])
        .build();

      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: SimulationSettingsBuilder.with()
          .energyGlobalPatternId(IDS.PAT)
          .build(),
        usedPatterns: true,
      });

      expect(inp).toContain("Global Pattern\tGPAT");
      expect(inp).toContain("GPAT\t0.5\t1\t1.5");
      expect(inp).not.toContain("UNUSED_PAT");
    });
  });
});
