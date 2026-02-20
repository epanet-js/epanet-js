import { parseInpWithPatterns } from "./parse-inp-with-patterns";

describe("parse pattern types", () => {
  it("sets type 'demand' on pattern used by junction demand", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    pattern1

    [PATTERNS]
    pattern1    1.0    1.2    0.8

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = hydraulicModel.patterns.get(1);
    expect(pattern?.type).toBe("demand");
  });

  it("sets type 'demand' on fallback pattern '1'", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50

    [PATTERNS]
    1    1.0    1.5

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = hydraulicModel.patterns.get(1);
    expect(pattern?.type).toBe("demand");
  });

  it("sets type 'demand' on OPTIONS PATTERN default", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50

    [OPTIONS]
    Pattern    myDefault

    [PATTERNS]
    myDefault    0.8    1.2

    [COORDINATES]
    J1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = hydraulicModel.patterns.get(1);
    expect(pattern?.type).toBe("demand");
  });

  it("keeps unused patterns in the model without type", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    usedPattern
    J2    100    0

    [PATTERNS]
    usedPattern    1.0    1.2
    unusedPattern    2.0    2.5

    [COORDINATES]
    J1    0    0
    J2    1    1

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const patterns = [...hydraulicModel.patterns.values()];
    const unused = patterns.find((p) => p.label === "unusedPattern");
    expect(unused).toBeDefined();
    expect(unused?.type).toBeUndefined();
  });

  it("sets headPatternId on reservoir when pattern is used", () => {
    const inp = `
    [RESERVOIRS]
    R1    100    resPat

    [PATTERNS]
    resPat    1.4    1.2    1.9

    [COORDINATES]
    R1    0    0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const reservoir = [...hydraulicModel.assets.values()].find(
      (a) => a.type === "reservoir",
    ) as import("src/hydraulic-model/asset-types/reservoir").Reservoir;
    expect(reservoir).toBeDefined();
    expect(reservoir.headPatternId).toBeDefined();
    const pattern = hydraulicModel.patterns.get(reservoir.headPatternId!);
    expect(pattern?.type).toBe("reservoirHead");
  });

  it("sets type 'reservoirHead' on pattern used by reservoir", () => {
    const inp = `
    [JUNCTIONS]
    J1    100

    [RESERVOIRS]
    R1    100    resPat

    [PATTERNS]
    resPat    1.4    1.2    1.9

    [COORDINATES]
    J1    0    0
    R1    2    2

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "resPat",
    );
    expect(pattern?.type).toBe("reservoirHead");
  });

  it("sets type 'pumpSpeed' on pattern used by pump", () => {
    const inp = `
    [JUNCTIONS]
    J1    100
    J2    100

    [PUMPS]
    PMP1    J1    J2    HEAD    curve1    PATTERN    pumpPat

    [CURVES]
    curve1    100    50

    [PATTERNS]
    pumpPat    1.5    1.2

    [COORDINATES]
    J1    0    0
    J2    1    1

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "pumpPat",
    );
    expect(pattern?.type).toBe("pumpSpeed");
  });

  it("sets type 'qualitySourceStrength' on pattern used by source", () => {
    const inp = `
    [JUNCTIONS]
    J1    100
    J2    100

    [SOURCES]
    J1    CONCEN    1.0    srcPat

    [PATTERNS]
    srcPat    0.5    1.5

    [COORDINATES]
    J1    0    0
    J2    1    1

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "srcPat",
    );
    expect(pattern?.type).toBe("qualitySourceStrength");
  });

  it("sets type 'energyPrice' on pattern used by energy", () => {
    const inp = `
    [JUNCTIONS]
    J1    100
    J2    100

    [ENERGY]
    Global Pattern    ePat

    [PATTERNS]
    ePat    0.8    1.2

    [COORDINATES]
    J1    0    0
    J2    1    1

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "ePat",
    );
    expect(pattern?.type).toBe("energyPrice");
  });
});

describe("comment-based pattern type fallback", () => {
  it("assigns demand type from comment for unused pattern", () => {
    const inp = `
    [JUNCTIONS]
    J1\t100

    [PATTERNS]
    ;DEMAND:
    pat1\t1.0\t1.2\t0.8

    [COORDINATES]
    J1\t0\t0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "pat1",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.type).toBe("demand");
  });

  it("assigns reservoirHead type from comment", () => {
    const inp = `
    [JUNCTIONS]
    J1\t100

    [PATTERNS]
    ;RESERVOIR:
    pat1\t1.4\t1.2\t1.9

    [COORDINATES]
    J1\t0\t0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "pat1",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.type).toBe("reservoirHead");
  });

  it("assigns pumpSpeed type from comment", () => {
    const inp = `
    [JUNCTIONS]
    J1\t100

    [PATTERNS]
    ;SPEED:
    pat1\t1.5\t1.2

    [COORDINATES]
    J1\t0\t0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "pat1",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.type).toBe("pumpSpeed");
  });

  it("does not count pattern as unused when type from comment", () => {
    const inp = `
    [JUNCTIONS]
    J1\t100

    [PATTERNS]
    ;DEMAND:
    pat1\t1.0\t1.2\t0.8

    [COORDINATES]
    J1\t0\t0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "pat1",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.type).toBe("demand");
  });

  it("usage-based type takes priority over comment", () => {
    const inp = `
    [JUNCTIONS]
    J1\t100\t50\tpat1

    [PATTERNS]
    ;SPEED:
    pat1\t1.0\t1.2\t0.8

    [COORDINATES]
    J1\t0\t0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "pat1",
    );
    expect(pattern!.type).toBe("demand");
  });

  it("preserves comment-based type when inactiveAssets is enabled", () => {
    const inp = `
    [JUNCTIONS]
    J1\t100

    [PATTERNS]
    ;DEMAND:
    pat1\t1.0\t1.2\t0.8

    [COORDINATES]
    J1\t0\t0

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp, {
      inactiveAssets: true,
    });
    const pattern = [...hydraulicModel.patterns.values()].find(
      (p) => p.label === "pat1",
    );
    expect(pattern).toBeDefined();
    expect(pattern!.type).toBe("demand");
  });
});

describe("pattern duplication for multi-type usage", () => {
  it("duplicates pattern used for all usage types, keeping only supported ones", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    sharedPat
    J2    100

    [RESERVOIRS]
    R1    100    sharedPat

    [PUMPS]
    PMP1    J1    J2    HEAD    curve1    PATTERN    sharedPat

    [CURVES]
    curve1    100    50

    [SOURCES]
    J1    CONCEN    1.0    sharedPat

    [ENERGY]
    Global Pattern    sharedPat

    [PATTERNS]
    sharedPat    1.0    1.2    0.8

    [COORDINATES]
    J1    0    0
    J2    1    1
    R1    2    2

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const patterns = [...hydraulicModel.patterns.values()];

    const demandPattern = patterns.find((p) => p.type === "demand");
    const headPattern = patterns.find((p) => p.type === "reservoirHead");
    const speedPattern = patterns.find((p) => p.type === "pumpSpeed");
    const sourcePattern = patterns.find(
      (p) => p.type === "qualitySourceStrength",
    );
    const energyPattern = patterns.find((p) => p.type === "energyPrice");

    // five distinct patterns, all with the same multipliers
    expect(patterns).toHaveLength(5);
    const ids = new Set(patterns.map((p) => p.id));
    expect(ids.size).toBe(5);
    for (const pattern of patterns) {
      expect(pattern.multipliers).toEqual([1.0, 1.2, 0.8]);
    }

    // each type is assigned correctly
    expect(demandPattern).toBeDefined();
    expect(headPattern).toBeDefined();
    expect(speedPattern).toBeDefined();
    expect(sourcePattern).toBeDefined();
    expect(energyPattern).toBeDefined();

    // original keeps label, duplicates get suffixed labels
    expect(demandPattern!.label).toBe("sharedPat");
    const duplicateLabels = new Set(
      [headPattern, speedPattern, sourcePattern, energyPattern].map(
        (p) => p!.label,
      ),
    );
    expect(duplicateLabels.size).toBe(4);
    for (const label of duplicateLabels) {
      expect(label).toMatch(/^sharedPat_\d+$/);
    }

    // assets reference the correct duplicate
    const pump = [...hydraulicModel.assets.values()].find(
      (a) => a.type === "pump",
    ) as import("src/hydraulic-model/asset-types/pump").Pump;
    expect(pump.speedPatternId).toBe(speedPattern!.id);

    const reservoir = [...hydraulicModel.assets.values()].find(
      (a) => a.type === "reservoir",
    ) as import("src/hydraulic-model/asset-types/reservoir").Reservoir;
    expect(reservoir.headPatternId).toBe(headPattern!.id);
  });

  it("does not duplicate when same pattern is used by multiple assets for the same type", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    50    sharedPat
    J2    100    30    sharedPat
    J3    100

    [PUMPS]
    PMP1    J1    J3    HEAD    curve1    PATTERN    sharedPat
    PMP2    J2    J3    HEAD    curve1    PATTERN    sharedPat

    [CURVES]
    curve1    100    50

    [PATTERNS]
    sharedPat    1.0    1.2    0.8

    [COORDINATES]
    J1    0    0
    J2    1    1
    J3    2    2

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    const patterns = [...hydraulicModel.patterns.values()];

    // one demand + one pumpSpeed, no extra duplicates
    expect(patterns).toHaveLength(2);

    const pumps = [...hydraulicModel.assets.values()].filter(
      (a) => a.type === "pump",
    ) as import("src/hydraulic-model/asset-types/pump").Pump[];
    expect(pumps[0].speedPatternId).toBe(pumps[1].speedPatternId);
  });
});
