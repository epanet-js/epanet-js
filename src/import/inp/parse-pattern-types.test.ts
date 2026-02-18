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

  it("excludes unused patterns from hydraulicModel.patterns", () => {
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

    expect(hydraulicModel.patterns.size).toBe(1);
    const demandPattern = hydraulicModel.patterns.get(1);
    expect(demandPattern?.type).toBe("demand");
  });

  it("reports unused patterns in issues", () => {
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

    const { issues } = parseInpWithPatterns(inp);
    expect(issues?.hasUnusedPatterns).toBe(1);
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

  it("does not report non-demand patterns as unused", () => {
    const inp = `
    [JUNCTIONS]
    J1    100
    J2    100

    [RESERVOIRS]
    R1    100    resPat

    [PUMPS]
    PMP1    J1    J2    HEAD    curve1    PATTERN    pumpPat

    [CURVES]
    curve1    100    50

    [SOURCES]
    J1    CONCEN    1.0    srcPat

    [ENERGY]
    Global Pattern    ePat
    Pump    PMP1    Pattern    pumpEPat

    [PATTERNS]
    resPat    1.4    1.2    1.9
    pumpPat    1.5    1.2
    srcPat    0.5    1.5
    ePat    0.8    1.2
    pumpEPat    0.9    1.1

    [COORDINATES]
    J1    0    0
    J2    1    1
    R1    2    2

    [END]
    `;

    const { issues } = parseInpWithPatterns(inp);
    expect(issues?.hasUnusedPatterns).toBeUndefined();
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

  it("excludes unsupported patterns (qualitySourceStrength, energyPrice) from the model", () => {
    const inp = `
    [JUNCTIONS]
    J1    100
    J2    100

    [SOURCES]
    J1    CONCEN    1.0    srcPat

    [ENERGY]
    Global Pattern    ePat

    [PATTERNS]
    srcPat    0.5    1.5
    ePat    0.8    1.2

    [COORDINATES]
    J1    0    0
    J2    1    1

    [END]
    `;

    const { hydraulicModel } = parseInpWithPatterns(inp);
    expect(hydraulicModel.patterns.size).toBe(0);
  });
});
