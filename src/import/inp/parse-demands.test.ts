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

    expect(junction.demands).toHaveLength(1);
    expect(junction.demands[0].baseDemand).toBe(50);
    expect(junction.demands[0].patternId).toBe("PATTERN1");
    expect(hydraulicModel.demands.patterns.size).toBe(1);
    expect(hydraulicModel.demands.patterns.get("PATTERN1")).toEqual([
      1.0, 1.2, 0.8,
    ]);
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

    expect(junction.demands).toHaveLength(1);
    expect(junction.demands[0].baseDemand).toBe(50);
    expect(junction.demands[0].patternId).toBe("PATTERN2");
    expect(hydraulicModel.demands.patterns.get("PATTERN2")).toEqual([0.5, 1.5]);
  });

  it("only stores patterns used by junctions with non-zero demand", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    pattern1
    J2    100    0    unusedPattern

    [PATTERNS]
    pattern1    1.0    1.2
    unusedPattern    2.0    2.5

    [COORDINATES]
    J1    0    0
    J2    1    1

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.demands.patterns.size).toBe(1);
    expect(hydraulicModel.demands.patterns.has("PATTERN1")).toBe(true);
    expect(hydraulicModel.demands.patterns.has("UNUSEDPATTERN")).toBe(false);
  });

  it("handles junction with zero demand (no pattern stored)", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    0

    [PATTERNS]
    1    1.0    1.5

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInp(inp);
    const junction = getByLabel(hydraulicModel.assets, "J1") as Junction;

    expect(junction.baseDemand).toBe(0);
    expect(hydraulicModel.demands.patterns.size).toBe(0);
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

    expect(hydraulicModel.demands.patterns.get("LONGPATTERN")).toEqual([
      1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 0.9, 0.8, 0.7,
    ]);
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

    expect(junction.demands).toHaveLength(2);
    expect(junction.demands[0].baseDemand).toBe(50);
    expect(junction.demands[0].patternId).toBe("PATTERN2");
    expect(junction.demands[1].baseDemand).toBe(30);
    expect(junction.demands[1].patternId).toBe("PATTERN3");

    expect(hydraulicModel.demands.patterns.size).toBe(2);
    expect(hydraulicModel.demands.patterns.has("PATTERN2")).toBe(true);
    expect(hydraulicModel.demands.patterns.has("PATTERN3")).toBe(true);
    expect(hydraulicModel.demands.patterns.has("PATTERN1")).toBe(false);
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

    expect(junction.demands).toHaveLength(1);
    expect(junction.demands[0].baseDemand).toBe(100);
    expect(junction.demands[0].patternId).toBe("PATTERN2");

    expect(hydraulicModel.demands.patterns.size).toBe(1);
    expect(hydraulicModel.demands.patterns.has("PATTERN2")).toBe(true);
    expect(hydraulicModel.demands.patterns.has("PATTERN1")).toBe(false);
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

    expect(junction.demands).toHaveLength(1);
    expect(junction.demands[0].baseDemand).toBe(50);
    expect(junction.demands[0].patternId).toBeUndefined();
    expect(hydraulicModel.demands.patterns.size).toBe(0);
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

    expect(junction.demands).toHaveLength(1);
    expect(junction.demands[0].baseDemand).toBe(75);
    expect(junction.demands[0].patternId).toBeUndefined();
    expect(hydraulicModel.demands.patterns.size).toBe(0);
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

    expect(junction.demands).toHaveLength(0);
    expect(hydraulicModel.demands.patterns.size).toBe(0);
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

      expect(junction.demands).toHaveLength(1);
      expect(junction.demands[0].patternId).toBe("1");
      expect(hydraulicModel.demands.patterns.has("1")).toBe(true);
      expect(hydraulicModel.demands.patterns.get("1")).toEqual([1.0, 1.5, 0.5]);
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

      expect(junction.demands).toHaveLength(1);
      expect(junction.demands[0].baseDemand).toBe(50);
      expect(junction.demands[0].patternId).toBeUndefined();
      expect(hydraulicModel.demands.patterns.size).toBe(0);
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

      expect(junction.demands).toHaveLength(1);
      expect(junction.demands[0].patternId).toBe("MYDEFAULTPATTERN");
      expect(hydraulicModel.demands.patterns.has("MYDEFAULTPATTERN")).toBe(
        true,
      );
      expect(hydraulicModel.demands.patterns.get("MYDEFAULTPATTERN")).toEqual([
        0.8, 1.2, 1.0,
      ]);
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

      expect(junction.demands).toHaveLength(1);
      expect(junction.demands[0].baseDemand).toBe(75);
      expect(junction.demands[0].patternId).toBe("MYDEFAULTPATTERN");
      expect(hydraulicModel.demands.patterns.has("MYDEFAULTPATTERN")).toBe(
        true,
      );
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

      expect(junction.demands).toHaveLength(1);
      expect(junction.demands[0].patternId).toBe("1");
      expect(hydraulicModel.demands.patterns.size).toBe(1);
      expect(hydraulicModel.demands.patterns.get("1")).toEqual([1.0, 1.5]);
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

      expect(junction.demands).toHaveLength(1);
      expect(junction.demands[0].patternId).toBeUndefined();
      expect(hydraulicModel.demands.patterns.size).toBe(0);
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

      expect(junction.demands).toHaveLength(1);
      expect(junction.demands[0].patternId).toBeUndefined();
      expect(hydraulicModel.demands.patterns.size).toBe(0);
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

      expect(junction.demands).toHaveLength(1);
      expect(junction.demands[0].baseDemand).toBe(75);
      expect(junction.demands[0].patternId).toBeUndefined();
      expect(hydraulicModel.demands.patterns.size).toBe(0);
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

      expect(junction.demands).toHaveLength(1);
      expect(junction.demands[0].baseDemand).toBe(50);
      expect(junction.demands[0].patternId).toBeUndefined();
      expect(hydraulicModel.demands.patterns.size).toBe(0);
    });
  });

  describe("demand multiplier", () => {
    it("includes demand multiplier when specified", () => {
      const inp = `
      [OPTIONS]
      Demand Multiplier\t20
      `;

      const { hydraulicModel } = parseInp(inp);

      expect(hydraulicModel.demands.multiplier).toEqual(20);
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

      expect(junction.demands).toEqual([{ baseDemand: 50 }]);
    });
  });
});
