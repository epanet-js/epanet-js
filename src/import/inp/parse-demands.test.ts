import { parseInp } from "./parse-inp";
import { Junction } from "src/hydraulic-model";
import { getByLabel } from "src/__helpers__/asset-queries";

describe("parse junctions demands", () => {
  it("parses junction with explicit pattern from JUNCTIONS section", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    pattern1

    [PATTERNS]
    pattern1    1.0    1.2    0.8

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

    expect(demands).toHaveLength(1);
    expect(demands[0].baseDemand).toBe(50);
    expect(demands[0].patternId).toBe(1);

    expect(hydraulicModel.patterns.size).toBe(1);
    const pattern = hydraulicModel.patterns.get(1);
    expect(pattern).toBeDefined();
    expect(pattern?.label).toBe("pattern1");
    expect(pattern?.multipliers).toEqual([1.0, 1.2, 0.8]);
  });

  it("parses junction with pattern from DEMANDS section", () => {
    const inp = `
    [JUNCTIONS]
    J1    100

    [DEMANDS]
    J1    50    pattern2

    [PATTERNS]
    pattern2    0.5    1.5

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

    expect(demands).toHaveLength(1);
    expect(demands[0].baseDemand).toBe(50);
    expect(demands[0].patternId).toBe(1);

    expect(hydraulicModel.patterns.size).toBe(1);
    const pattern = hydraulicModel.patterns.get(1);
    expect(pattern?.label).toBe("pattern2");
    expect(pattern?.multipliers).toEqual([0.5, 1.5]);
  });

  it("stores all patterns by default regardless of usage", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    pattern1
    J2    100    0    unusedPattern

    [PATTERNS]
    pattern1    1.0    1.2
    unusedPattern    2.0    2.5
    otherUnusedPattern  0.5    1.5

    [COORDINATES]
    J1    0    0
    J2    1    1

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.patterns.size).toBe(3);
    expect(hydraulicModel.patterns.get(1)?.label).toBe("pattern1");
    expect(hydraulicModel.patterns.get(2)?.label).toBe("unusedPattern");
    expect(hydraulicModel.patterns.get(3)?.label).toBe("otherUnusedPattern");
  });

  it("parses multi-line patterns", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    longPattern

    [PATTERNS]
    longPattern    1.0    1.1    1.2    1.3    1.4    1.5
    longPattern    0.9    0.8    0.7

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.patterns.size).toBe(1);
    const pattern = hydraulicModel.patterns.get(1)!;
    expect(pattern.multipliers).toEqual([
      1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 0.9, 0.8, 0.7,
    ]);
    expect(pattern.label).toBe("longPattern");
  });

  it("parses multiple demand categories per junction from DEMANDS section", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    20    pattern1

    [DEMANDS]
    J1    50    pattern2
    J1    30    pattern3

    [PATTERNS]
    pattern1    1.0    1.2
    pattern2    0.5    1.5
    pattern3    2.0    0.8

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

    expect(demands).toHaveLength(2);
    expect(demands[0].baseDemand).toBe(50);
    expect(demands[0].patternId).toBe(2);
    expect(demands[1].baseDemand).toBe(30);
    expect(demands[1].patternId).toBe(3);

    // All patterns are stored, including unused pattern1
    expect(hydraulicModel.patterns.size).toBe(3);
    expect(hydraulicModel.patterns.get(1)?.label).toBe("pattern1");
    expect(hydraulicModel.patterns.get(2)?.label).toBe("pattern2");
    expect(hydraulicModel.patterns.get(3)?.label).toBe("pattern3");
  });

  it("DEMANDS section overwrites JUNCTIONS section demand", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    pattern1

    [DEMANDS]
    J1    100    pattern2

    [PATTERNS]
    pattern1    1.0    1.2
    pattern2    2.0    0.5

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

    expect(demands).toHaveLength(1);
    expect(demands[0].baseDemand).toBe(100);
    expect(demands[0].patternId).toBe(2);

    // Both patterns are stored even though pattern1 is not used
    expect(hydraulicModel.patterns.size).toBe(2);
    expect(hydraulicModel.patterns.get(1)?.label).toBe("pattern1");
    expect(hydraulicModel.patterns.get(2)?.label).toBe("pattern2");
  });

  it("treats pattern with all 1s as constant (no pattern stored)", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    constantPattern

    [PATTERNS]
    constantPattern    1.0    1.0    1.0

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

    expect(demands).toHaveLength(1);
    expect(demands[0].baseDemand).toBe(50);
    expect(demands[0].patternId).toBeUndefined();
    expect(hydraulicModel.patterns.size).toBe(0);
  });

  it("parses constant demand from DEMANDS section (no pattern)", () => {
    const inp = `
    [JUNCTIONS]
    J1    100

    [DEMANDS]
    J1    75

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

    expect(demands).toHaveLength(1);
    expect(demands[0].baseDemand).toBe(75);
    expect(demands[0].patternId).toBeUndefined();
    expect(hydraulicModel.patterns.size).toBe(0);
  });

  it("returns empty demands array when junction has no demand", () => {
    const inp = `
    [JUNCTIONS]
    J1    100

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

    expect(demands).toHaveLength(0);
    expect(hydraulicModel.patterns.size).toBe(0);
  });

  describe("default pattern", () => {
    it("uses default pattern '1' when junction has demand but no explicit pattern", () => {
      const inp = `
      [JUNCTIONS]
      J1    100    50

      [PATTERNS]
      1    1.0    1.5    0.5

      [COORDINATES]
      J1    0    0

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].patternId).toBe(1);

      expect(hydraulicModel.patterns.size).toBe(1);
      expect(hydraulicModel.patterns.get(1)?.label).toBe("1");
      expect(hydraulicModel.patterns.get(1)?.multipliers).toEqual([
        1.0, 1.5, 0.5,
      ]);
    });

    it("uses constant demand when default pattern '1' does not exist", () => {
      const inp = `
      [JUNCTIONS]
      J1    100    50

      [PATTERNS]
      otherPattern    0.5    1.5

      [COORDINATES]
      J1    0    0

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].baseDemand).toBe(50);
      expect(demands[0].patternId).toBeUndefined();
      // Pattern is still stored even if not used by this junction
      expect(hydraulicModel.patterns.size).toBe(1);
      expect(hydraulicModel.patterns.get(1)?.label).toBe("otherPattern");
    });

    it("uses OPTIONS PATTERN as default for JUNCTIONS section", () => {
      const inp = `
      [JUNCTIONS]
      J1    100    50

      [OPTIONS]
      Pattern    myDefaultPattern

      [PATTERNS]
      myDefaultPattern    0.8    1.2    1.0

      [COORDINATES]
      J1    0    0

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].patternId).toBe(1);

      expect(hydraulicModel.patterns.size).toBe(1);
      const pattern = hydraulicModel.patterns.get(1);
      expect(pattern?.id).toBe(1);
      expect(pattern?.label).toBe("myDefaultPattern");
      expect(pattern?.multipliers).toEqual([0.8, 1.2, 1.0]);
    });

    it("uses OPTIONS PATTERN as default for DEMANDS section", () => {
      const inp = `
      [JUNCTIONS]
      J1    100

      [DEMANDS]
      J1    75

      [OPTIONS]
      Pattern    myDefaultPattern

      [PATTERNS]
      myDefaultPattern    0.8    1.2    1.0

      [COORDINATES]
      J1    0    0

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].baseDemand).toBe(75);
      expect(demands[0].patternId).toBe(1);

      expect(hydraulicModel.patterns.size).toBe(1);
      const pattern = hydraulicModel.patterns.get(1);
      expect(pattern?.id).toBe(1);
      expect(pattern?.label).toBe("myDefaultPattern");
      expect(pattern?.multipliers).toEqual([0.8, 1.2, 1.0]);
    });

    it("falls back to pattern '1' when OPTIONS PATTERN does not exist", () => {
      const inp = `
      [JUNCTIONS]
      J1    100    50

      [OPTIONS]
      Pattern    nonExistentPattern

      [PATTERNS]
      1    1.0    1.5

      [COORDINATES]
      J1    0    0

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].patternId).toBe(1);

      expect(hydraulicModel.patterns.size).toBe(1);
      const pattern = hydraulicModel.patterns.get(1);
      expect(pattern?.id).toBe(1);
      expect(pattern?.label).toBe("1");
      expect(pattern?.multipliers).toEqual([1.0, 1.5]);
    });

    it("uses constant demand when OPTIONS PATTERN does not exist and pattern '1' does not exist", () => {
      const inp = `
      [JUNCTIONS]
      J1    100    50

      [OPTIONS]
      Pattern    nonExistentPattern

      [PATTERNS]
      otherPattern    1.0    1.5

      [COORDINATES]
      J1    0    0

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].patternId).toBeUndefined();
      // Pattern is still stored even if not used
      expect(hydraulicModel.patterns.size).toBe(1);
      expect(hydraulicModel.patterns.get(1)?.label).toBe("otherPattern");
    });

    it("uses constant demand when OPTIONS PATTERN does not exist and pattern '1' is constant", () => {
      const inp = `
      [JUNCTIONS]
      J1    100    50

      [OPTIONS]
      Pattern    nonExistentPattern

      [PATTERNS]
      1    1.0    1.0    1.0

      [COORDINATES]
      J1    0    0

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].patternId).toBeUndefined();
      expect(hydraulicModel.patterns.size).toBe(0);
    });

    it("uses constant demand for DEMANDS section when OPTIONS PATTERN does not exist", () => {
      const inp = `
      [JUNCTIONS]
      J1    100

      [DEMANDS]
      J1    75

      [OPTIONS]
      Pattern    nonExistentPattern

      [PATTERNS]
      otherPattern    1.0    1.5

      [COORDINATES]
      J1    0    0

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].baseDemand).toBe(75);
      expect(demands[0].patternId).toBeUndefined();
      // Pattern is still stored even if not used
      expect(hydraulicModel.patterns.size).toBe(1);
      expect(hydraulicModel.patterns.get(1)?.label).toBe("otherPattern");
    });

    it("uses constant demand when OPTIONS PATTERN is a constant pattern (all 1s)", () => {
      const inp = `
      [JUNCTIONS]
      J1    100    50

      [OPTIONS]
      Pattern    myConstantPattern

      [PATTERNS]
      myConstantPattern    1.0    1.0    1.0

      [COORDINATES]
      J1    0    0

      [END]
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].baseDemand).toBe(50);
      expect(demands[0].patternId).toBeUndefined();
      expect(hydraulicModel.patterns.size).toBe(0);
    });
  });

  describe("demand multiplier", () => {
    it("includes demand multiplier when specified", () => {
      const inp = `
      [OPTIONS]
      Demand Multiplier\t20
      `;

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.globalDemandMultiplier).toEqual(20);
    });
  });

  describe("demand model options", () => {
    it("parses demand model PDA", () => {
      const inp = `
      [OPTIONS]
      Demand Model\tPDA
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.demandModel).toEqual("PDA");
    });

    it("parses demand model DDA", () => {
      const inp = `
      [OPTIONS]
      Demand Model\tDDA
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.demandModel).toEqual("DDA");
    });

    it("defaults to DDA when not specified", () => {
      const inp = `
      [OPTIONS]
      Units\tLPS
      `;

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.demandModel).toEqual("DDA");
    });

    it("parses minimum pressure", () => {
      const inp = `
      [OPTIONS]
      Minimum Pressure\t5
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.minimumPressure).toEqual(5);
    });

    it("parses required pressure", () => {
      const inp = `
      [OPTIONS]
      Required Pressure\t20
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.requiredPressure).toEqual(20);
    });

    it("parses pressure exponent", () => {
      const inp = `
      [OPTIONS]
      Pressure Exponent\t0.8
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.pressureExponent).toEqual(0.8);
    });

    it("uses default values when pressure options not specified", () => {
      const inp = `
      [OPTIONS]
      Units\tLPS
      `;

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.minimumPressure).toEqual(0);
      expect(simulationSettings.requiredPressure).toEqual(0.1);
      expect(simulationSettings.pressureExponent).toEqual(0.5);
    });

    it("does not report demand model options as non-default when extraOptions enabled", () => {
      const inp = `
      [OPTIONS]
      Demand Model\tPDA
      Minimum Pressure\t5
      Required Pressure\t20
      Pressure Exponent\t0.8
      `;

      const { issues } = parseInp(inp, { extraOptions: true });

      expect(issues?.nonDefaultOptions?.has("DEMAND MODEL")).toBeFalsy();
      expect(issues?.nonDefaultOptions?.has("MINIMUM PRESSURE")).toBeFalsy();
      expect(issues?.nonDefaultOptions?.has("REQUIRED PRESSURE")).toBeFalsy();
      expect(issues?.nonDefaultOptions?.has("PRESSURE EXPONENT")).toBeFalsy();
    });

    it("reports demand model options as non-default when extraOptions not enabled", () => {
      const inp = `
      [OPTIONS]
      Demand Model\tPDA
      Minimum Pressure\t5
      Required Pressure\t20
      Pressure Exponent\t0.8
      `;

      const { issues } = parseInp(inp);

      expect(issues?.nonDefaultOptions?.has("DEMAND MODEL")).toBe(true);
      expect(issues?.nonDefaultOptions?.has("MINIMUM PRESSURE")).toBe(true);
      expect(issues?.nonDefaultOptions?.has("REQUIRED PRESSURE")).toBe(true);
      expect(issues?.nonDefaultOptions?.has("PRESSURE EXPONENT")).toBe(true);
    });
  });

  describe("emitter options", () => {
    it("parses emitter exponent", () => {
      const inp = `
      [OPTIONS]
      Emitter Exponent\t0.7
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.emitterExponent).toEqual(0.7);
    });

    it("uses default emitter exponent when not specified", () => {
      const inp = `
      [OPTIONS]
      Units\tLPS
      `;

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.emitterExponent).toEqual(0.5);
    });

    it("does not report emitter exponent as non-default when extraOptions enabled", () => {
      const inp = `
      [OPTIONS]
      Emitter Exponent\t0.7
      `;

      const { issues } = parseInp(inp, { extraOptions: true });

      expect(issues?.nonDefaultOptions?.has("EMITTER EXPONENT")).toBeFalsy();
    });

    it("reports emitter exponent as non-default when extraOptions not enabled", () => {
      const inp = `
      [OPTIONS]
      Emitter Exponent\t0.7
      `;

      const { issues } = parseInp(inp);

      expect(issues?.nonDefaultOptions?.has("EMITTER EXPONENT")).toBe(true);
    });

    it("silently ignores emitter backflow when extraOptions enabled", () => {
      const inp = `
      [OPTIONS]
      Emitter Backflow\tNO
      `;

      const { issues } = parseInp(inp, { extraOptions: true });

      expect(issues?.nonDefaultOptions?.has("EMITTER BACKFLOW")).toBeFalsy();
    });

    it("reports emitter backflow as non-default when extraOptions not enabled", () => {
      const inp = `
      [OPTIONS]
      Emitter Backflow\tNO
      `;

      const { issues } = parseInp(inp);

      expect(issues?.nonDefaultOptions?.has("EMITTER BACKFLOW")).toBe(true);
    });
  });

  describe("epanetjs_customers pattern", () => {
    it("ignores demands with epanetjs_customers pattern", () => {
      const inp = `
      [JUNCTIONS]
      J1\t100

      [DEMANDS]
      J1\t50
      J1\t25\tepanetjs_customers

      [COORDINATES]
      J1\t0\t0

      [PATTERNS]
      epanetjs_customers\t1
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toEqual([{ baseDemand: 50 }]);
      expect(hydraulicModel.patterns.size).toBe(0);
    });

    it("ignores demands with epanetjs_customers in comment", () => {
      const inp = `
      [JUNCTIONS]
      J1\t100

      [DEMANDS]
      J1\t50\tpattern1
      J1\t25\tresidential;epanetjs_customers

      [COORDINATES]
      J1\t0\t0

      [PATTERNS]
      pattern1\t1\t1.2
      residential\t0.8\t1.2
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(1);
      expect(demands[0].baseDemand).toBe(50);
      expect(demands[0].patternId).toBe(1);

      // Both patterns are stored even though residential is not used
      expect(hydraulicModel.patterns.size).toBe(2);
      expect(hydraulicModel.patterns.get(1)?.label).toBe("pattern1");
      expect(hydraulicModel.patterns.get(2)?.label).toBe("residential");
    });

    it("keeps demands without epanetjs_customers pattern or comment", () => {
      const inp = `
      [JUNCTIONS]
      J1\t100

      [DEMANDS]
      J1\t50\tpattern1
      J1\t25\tresidential;regular customer demand

      [COORDINATES]
      J1\t0\t0

      [PATTERNS]
      pattern1\t1\t1.2
      residential\t0.8\t1.2
      `;

      const { hydraulicModel } = parseInp(inp);
      const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const demands = hydraulicModel.demands.junctions.get(junction.id) ?? [];

      expect(demands).toHaveLength(2);
      expect(demands[0].baseDemand).toBe(50);
      expect(demands[0].patternId).toBe(1);
      expect(demands[1].baseDemand).toBe(25);
      expect(demands[1].patternId).toBe(2);

      expect(hydraulicModel.patterns.size).toBe(2);
      const pattern1 = hydraulicModel.patterns.get(1);
      expect(pattern1?.id).toBe(1);
      expect(pattern1?.label).toBe("pattern1");
      const pattern2 = hydraulicModel.patterns.get(2);
      expect(pattern2?.id).toBe(2);
      expect(pattern2?.label).toBe("residential");
    });
  });

  describe("water quality options", () => {
    it("parses QUALITY NONE when extraOptions enabled", () => {
      const inp = `
      [OPTIONS]
      Quality\tNONE
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.qualitySimulationType).toEqual("NONE");
    });

    it("parses QUALITY AGE when extraOptions enabled", () => {
      const inp = `
      [OPTIONS]
      Quality\tAGE
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.qualitySimulationType).toEqual("AGE");
    });

    it("parses QUALITY TRACE with node ID when extraOptions enabled", () => {
      const inp = `
      [JUNCTIONS]
      Tank23\t100
      [COORDINATES]
      Tank23\t0\t0
      [OPTIONS]
      Quality\tTRACE Tank23
      `;

      const { simulationSettings, hydraulicModel } = parseInp(inp, {
        extraOptions: true,
      });

      expect(simulationSettings.qualitySimulationType).toEqual("TRACE");
      expect(simulationSettings.qualityTraceNodeId).toBeGreaterThan(0);
      const asset = hydraulicModel.assets.get(
        simulationSettings.qualityTraceNodeId!,
      );
      expect(asset?.label).toEqual("Tank23");
    });

    it("parses QUALITY TRACE with unknown node as null", () => {
      const inp = `
      [OPTIONS]
      Quality\tTRACE UnknownNode
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.qualitySimulationType).toEqual("TRACE");
      expect(simulationSettings.qualityTraceNodeId).toBeNull();
    });

    it("parses QUALITY CHEMICAL with name and units when extraOptions enabled", () => {
      const inp = `
      [OPTIONS]
      Quality\tChlorine mg/L
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.qualitySimulationType).toEqual("CHEMICAL");
      expect(simulationSettings.qualityChemicalName).toEqual("Chlorine");
      expect(simulationSettings.qualityMassUnit).toEqual("mg/L");
    });

    it("parses QUALITY CHEMICAL with ug/L unit", () => {
      const inp = `
      [OPTIONS]
      Quality\tFluoride ug/L
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.qualitySimulationType).toEqual("CHEMICAL");
      expect(simulationSettings.qualityChemicalName).toEqual("Fluoride");
      expect(simulationSettings.qualityMassUnit).toEqual("ug/L");
    });

    it("reports water quality type as issue when extraOptions not enabled", () => {
      const inp = `
      [OPTIONS]
      Quality\tAGE
      `;

      const { issues } = parseInp(inp);

      expect(issues?.waterQualityType).toEqual("AGE");
    });

    it("parses TOLERANCE when extraOptions enabled", () => {
      const inp = `
      [OPTIONS]
      Tolerance\t0.05
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.tolerance).toEqual(0.05);
    });

    it("reports TOLERANCE as non-default when extraOptions not enabled", () => {
      const inp = `
      [OPTIONS]
      Tolerance\t0.05
      `;

      const { issues } = parseInp(inp);

      expect(issues?.nonDefaultOptions?.has("TOLERANCE")).toBe(true);
    });

    it("parses DIFFUSIVITY when extraOptions enabled", () => {
      const inp = `
      [OPTIONS]
      Diffusivity\t2.0
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.diffusivity).toEqual(2.0);
    });

    it("reports DIFFUSIVITY as non-default when extraOptions not enabled", () => {
      const inp = `
      [OPTIONS]
      Diffusivity\t2.0
      `;

      const { issues } = parseInp(inp);

      expect(issues?.nonDefaultOptions?.has("DIFFUSIVITY")).toBe(true);
    });
  });

  describe("reaction options", () => {
    it("parses reaction settings when extraOptions enabled", () => {
      const inp = `
      [REACTIONS]
      Order Bulk\t2
      Order Wall\t0
      Order Tank\t1
      Global Bulk\t-0.5
      Global Wall\t-1.0
      Limiting Potential\t0.5
      Roughness Correlation\t0.1
      `;

      const { simulationSettings } = parseInp(inp, { extraOptions: true });

      expect(simulationSettings.reactionBulkOrder).toEqual(2);
      expect(simulationSettings.reactionWallOrder).toEqual(0);
      expect(simulationSettings.reactionTankOrder).toEqual(1);
      expect(simulationSettings.reactionGlobalBulk).toEqual(-0.5);
      expect(simulationSettings.reactionGlobalWall).toEqual(-1.0);
      expect(simulationSettings.reactionLimitingPotential).toEqual(0.5);
      expect(simulationSettings.reactionRoughnessCorrelation).toEqual(0.1);
    });

    it("does not report reactions as unsupported when extraOptions enabled", () => {
      const inp = `
      [REACTIONS]
      Global Bulk\t-0.5
      `;

      const { issues } = parseInp(inp, { extraOptions: true });

      expect(issues?.unsupportedSections?.has("[REACTIONS]")).toBeFalsy();
    });

    it("still reports pipe-specific reactions as unsupported when extraOptions enabled", () => {
      const inp = `
      [REACTIONS]
      Bulk  P1  0.5
      `;

      const { issues } = parseInp(inp, { extraOptions: true });

      expect(issues?.unsupportedSections?.has("[REACTIONS]")).toBe(true);
    });

    it("reports reactions as unsupported when extraOptions not enabled", () => {
      const inp = `
      [REACTIONS]
      Global Bulk\t-0.5
      `;

      const { issues } = parseInp(inp);

      expect(issues?.unsupportedSections?.has("[REACTIONS]")).toBe(true);
    });
  });
});
