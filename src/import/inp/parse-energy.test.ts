import { Pump } from "src/hydraulic-model";
import { getByLabel } from "src/__helpers__/asset-queries";
import { parseInp } from "./parse-inp";

const coords = (ids: string[]) =>
  `[COORDINATES]\n` + ids.map((id) => `${id}\t10\t20`).join("\n");

const basePumpInp = (energyLines: string) => `
  [JUNCTIONS]
  j1\t10
  j2\t10
  [PUMPS]
  pu1\tj1\tj2\tPOWER 10
  [ENERGY]
  ${energyLines}
  [PATTERNS]
  PAT1\t0.8\t1.2
  [CURVES]
  EFF1\t0\t50
  EFF1\t50\t80
  EFF1\t100\t60
  ${coords(["j1", "j2"])}
`;

describe("parse energy", () => {
  describe("per-pump energy", () => {
    it("parses efficiency curve label onto pump", () => {
      const inp = basePumpInp("PUMP\tpu1\tEFFICIENCY\tEFF1");

      const { hydraulicModel } = parseInp(inp);
      const pump = getByLabel(hydraulicModel.assets, "pu1") as Pump;

      expect(pump.efficiencyCurveId).toBeDefined();
      const curve = hydraulicModel.curves.get(pump.efficiencyCurveId!)!;
      expect(curve.label).toBe("EFF1");
      expect(curve.type).toBe("efficiency");
    });

    it("parses energy price onto pump", () => {
      const inp = basePumpInp("PUMP\tpu1\tPRICE\t0.12");

      const { hydraulicModel } = parseInp(inp);
      const pump = getByLabel(hydraulicModel.assets, "pu1") as Pump;

      expect(pump.energyPrice).toBe(0.12);
    });

    it("parses energy price pattern onto pump", () => {
      const inp = basePumpInp("PUMP\tpu1\tPATTERN\tPAT1");

      const { hydraulicModel } = parseInp(inp);
      const pump = getByLabel(hydraulicModel.assets, "pu1") as Pump;

      expect(pump.energyPricePatternId).toBeDefined();
      const pattern = hydraulicModel.patterns.get(pump.energyPricePatternId!)!;
      expect(pattern.label).toBe("PAT1");
      expect(pattern.type).toBe("energyPrice");
    });

    it("parses all energy fields for a single pump", () => {
      const inp = basePumpInp(
        [
          "PUMP\tpu1\tEFFICIENCY\tEFF1",
          "PUMP\tpu1\tPRICE\t0.05",
          "PUMP\tpu1\tPATTERN\tPAT1",
        ].join("\n"),
      );

      const { hydraulicModel } = parseInp(inp);
      const pump = getByLabel(hydraulicModel.assets, "pu1") as Pump;

      expect(pump.efficiencyCurveId).toBeDefined();
      expect(pump.energyPrice).toBe(0.05);
      expect(pump.energyPricePatternId).toBeDefined();
    });
  });

  describe("global energy settings", () => {
    it("parses global efficiency", () => {
      const inp = basePumpInp("Global Efficiency\t80");

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.energyGlobalEfficiency).toBe(80);
    });

    it("parses global price", () => {
      const inp = basePumpInp("Global Price\t0.12");

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.energyGlobalPrice).toBe(0.12);
    });

    it("parses demand charge", () => {
      const inp = basePumpInp("Demand Charge\t25");

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.energyDemandCharge).toBe(25);
    });

    it("parses global pattern", () => {
      const inp = basePumpInp("Global Pattern\tPAT1");

      const { hydraulicModel, simulationSettings } = parseInp(inp);

      expect(simulationSettings.energyGlobalPatternId).toBeDefined();
      const pattern = hydraulicModel.patterns.get(
        simulationSettings.energyGlobalPatternId!,
      )!;
      expect(pattern.label).toBe("PAT1");
    });

    it("ignores undefined global pattern", () => {
      const inp = basePumpInp("Global Pattern\tNONEXISTENT");

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.energyGlobalPatternId).toBeNull();
    });

    it("uses defaults when no energy settings are specified", () => {
      const inp = basePumpInp("");

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.energyGlobalEfficiency).toBe(75);
      expect(simulationSettings.energyGlobalPrice).toBe(0);
      expect(simulationSettings.energyGlobalPatternId).toBeNull();
      expect(simulationSettings.energyDemandCharge).toBe(0);
    });
  });

  describe("undefined references", () => {
    it("ignores undefined pump efficiency curve", () => {
      const inp = basePumpInp("PUMP\tpu1\tEFFICIENCY\tNONEXISTENT");

      const { hydraulicModel } = parseInp(inp);
      const pump = getByLabel(hydraulicModel.assets, "pu1") as Pump;

      expect(pump.efficiencyCurveId).toBeUndefined();
    });

    it("ignores undefined pump energy price pattern", () => {
      const inp = basePumpInp("PUMP\tpu1\tPATTERN\tNONEXISTENT");

      const { hydraulicModel } = parseInp(inp);
      const pump = getByLabel(hydraulicModel.assets, "pu1") as Pump;

      expect(pump.energyPricePatternId).toBeUndefined();
    });
  });
});
