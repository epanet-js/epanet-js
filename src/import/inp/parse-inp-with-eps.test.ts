import { Junction, Pipe, Reservoir } from "src/hydraulic-model";
import { parseInpWithEPS } from "./parse-inp-with-eps";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInpEPS } from "src/simulation/build-inp-eps";
import { getByLabel } from "src/__helpers__/asset-queries";
import { Valve } from "src/hydraulic-model/asset-types";

describe("Parse inp with EPS", () => {
  it("can read values separated by spaces", () => {
    const IDS = { J1: 1 } as const;
    const elevation = 100;
    const lat = 10;
    const lng = 20;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${IDS.J1} ${elevation}

    [COORDINATES]
    ${IDS.J1} ${lng}        ${lat}

    [DEMANDS]
    ${IDS.J1} ${demand}
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction.elevation).toEqual(elevation);
    expect(junction.demands[0].baseDemand).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);
  });

  it("ignores white lines when reading a section", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const elevation = 100;
    const otherElevation = 200;
    const coordintes = { lat: 10, lng: 20 };
    const otherCoordinates = { lat: 30, lng: 40 };
    const demand = 0.1;
    const otherDemand = 0.2;

    const inp = `
    [JUNCTIONS]
    ${IDS.J1} ${elevation}

    ${IDS.J2} ${otherElevation}

    [COORDINATES]
    ${IDS.J1} ${coordintes.lng}        ${coordintes.lat}



    ${IDS.J2} ${otherCoordinates.lng}        ${otherCoordinates.lat}
    [DEMANDS]
    ${IDS.J1} ${demand}

    ${IDS.J2} ${otherDemand}
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction.elevation).toEqual(elevation);
    expect(junction.demands[0].baseDemand).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);

    const otherJunction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J2),
    ) as Junction;
    expect(otherJunction.elevation).toEqual(otherElevation);
    expect(otherJunction.demands[0].baseDemand).toEqual(otherDemand);
    expect(otherJunction.coordinates).toEqual([40, 30]);
  });

  it("ignores comments", () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ;ID\tHEAD
    ${IDS.R1}\t${head};__valuecomment

    [COORDINATES]
    ${IDS.R1}\t${lng}\t${lat};__anothercomment
    ${IDS.J1}\t1\t1

    [JUNCTIONS]
    ${IDS.J1}\t10
    [PIPES]
    ${IDS.P1}\t${IDS.R1}\t${IDS.J1}\t10\t10\t10\t10\tOpen;__anothercommnet
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir.id).not.toBeUndefined();
    expect(reservoir.head).toEqual(100);
    expect(reservoir.coordinates).toEqual([lng, lat]);
    const pipe = getByLabel(hydraulicModel.assets, String(IDS.P1)) as Pipe;
    expect(pipe.initialStatus).toEqual("open");
    expect(hydraulicModel.assets.size).toEqual(3);
  });

  it("ignores unsupported sections", () => {
    const IDS = { R1: 1 } as const;
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t${head}

    [COORDINATES]
    ${IDS.R1}\t${lng}\t${lat}

    [MIXING]
    ANYTHING
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir.id).not.toBeUndefined();
    expect(hydraulicModel.assets.size).toEqual(1);
  });

  it("detects the us customary unit system", () => {
    const IDS = { R1: 1 } as const;
    const head = 100;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t${head}
    [OPTIONS]
    ANY
    Units\tGPM
    ANY
    [COORDINATES]
    ${IDS.R1}\t1\t1
    `;
    const { hydraulicModel, modelMetadata } = parseInpWithEPS(inp);
    expect(hydraulicModel.units).toMatchObject({
      flow: "gal/min",
    });
    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir.getUnit("head")).toEqual("ft");

    expect(modelMetadata.quantities.getUnit("head")).toEqual("ft");
  });

  it("detects other systems", () => {
    const IDS = { R1: 1 } as const;
    const head = 100;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t${head}
    [OPTIONS]
    ANY
    Units\tLPS
    ANY
    [COORDINATES]
    ${IDS.R1}\t1\t1
    `;
    const { hydraulicModel } = parseInpWithEPS(inp);
    expect(hydraulicModel.units).toMatchObject({
      flow: "l/s",
    });
    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir.getUnit("head")).toEqual("m");
  });

  it("detects headloss formula from inp", () => {
    const inp = `
    [OPTIONS]
    ANY
    Units\tLPS
    Headloss\tD-W
    ANY
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.headlossFormula).toEqual("D-W");
  });

  it("says when inp contains unsupported sections", () => {
    const inp = `
    [MIXING]
    ANY
    [NEW]
    `;

    const { issues } = parseInpWithEPS(inp);

    expect(issues!.unsupportedSections!.values()).toContain("[MIXING]");
    expect(issues!.unsupportedSections!.values()).toContain("[NEW]");
  });

  it("ignores default sections", () => {
    const inp = `
    [TITLE]
    ANY
    [REPORT]
    ANY
    `;

    const { issues } = parseInpWithEPS(inp);

    expect(issues).toBeNull();
  });

  it("says when coordinates are missing", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const elevation = 100;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${IDS.J1}\t${elevation}
    ${IDS.J2}\t${elevation}

    [DEMANDS]
    ${IDS.J1}\t${demand}
    ${IDS.J2}\t${demand}

    [COORDINATES]
    ${IDS.J2}\t10\t10
    `;

    const {
      hydraulicModel: { assets },
      issues,
    } = parseInpWithEPS(inp);

    expect(issues!.nodesMissingCoordinates!.values()).toContain(String(IDS.J1));
    expect(getByLabel(assets, String(IDS.J1))).toBeUndefined();
    expect(getByLabel(assets, String(IDS.J2))).not.toBeUndefined();
  });

  it("says when coordinates are invalid", () => {
    const IDS = { J1: 1 } as const;
    const elevation = 100;
    const demand = 0.1;
    const inp = `
    [JUNCTIONS]
    ${IDS.J1}\t${elevation}

    [DEMANDS]
    ${IDS.J1}\t${demand}

    [COORDINATES]
    ${IDS.J1}\t1000\t2000
    `;

    const {
      hydraulicModel: { assets },
      issues,
    } = parseInpWithEPS(inp);

    expect(issues!.invalidCoordinates!.values()).toContain(String(IDS.J1));
    expect(assets.get(IDS.J1)).toBeUndefined();
  });

  it("says when vertices  are invalid", () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const length = 10;
    const diameter = 100;
    const roughness = 0.1;
    const minorLoss = 0.2;
    const status = "Open";
    const anyNumber = 10;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t${anyNumber}
    [JUNCTIONS]
    ${IDS.J1}\t${anyNumber}
    [PIPES]
    ${IDS.P1}\t${IDS.R1}\t${IDS.J1}\t${length}\t${diameter}\t${roughness}\t${minorLoss}\t${status}

    [COORDINATES]
    ${IDS.R1}\t${10}\t${20}
    ${IDS.J1}\t${30}\t${40}


    [VERTICES]
    ${IDS.P1}\t${1000}\t${60}
    ${IDS.P1}\t${60}\t${700}
    `;

    const {
      hydraulicModel: { assets },
      issues,
    } = parseInpWithEPS(inp);

    expect(issues!.invalidVertices!.values()).toContain(String(IDS.P1));
    expect(getByLabel(assets, String(IDS.P1))).not.toBeUndefined();
  });

  it("says when using non default options", () => {
    const inp = `
    [OPTIONS]
    Specific Gravity\t2
    Tolerance\t0.00001
    DIFFUSIVITY\t1.0
    TANK MIXING\tMIXED
    Quality\tNONE
    `;

    const { issues } = parseInpWithEPS(inp);

    expect([...issues!.nonDefaultOptions!.keys()]).toEqual([
      "SPECIFIC GRAVITY",
      "TOLERANCE",
    ]);
  });

  it("supports demo network settings", () => {
    const inp = `
    [OPTIONS]
    Quality\tNONE
    Unbalanced\tCONTINUE 10
    Accuracy\t0.001
    Units\tLPS
    Headloss\tH-W

    [TIMES]
    Duration\t0
    Pattern Timestep\t0
 `;
    const { issues } = parseInpWithEPS(inp);

    expect(issues).toBeNull();
  });

  it("can read settings with spaces", () => {
    const inp = `
    [OPTIONS]
    Quality NONE
    Unbalanced     CONTINUE 10
    Accuracy   0.001
    Units     MGD
    Headloss H-W
 `;
    const { modelMetadata, issues } = parseInpWithEPS(inp);

    expect(issues).toBeNull();
    expect(modelMetadata.quantities.specName).toEqual("MGD");
  });

  it("treats 'None mg/L' quality setting as equivalent to 'None'", () => {
    const inp = `
    [OPTIONS]
    Quality None mg/L
    Unbalanced CONTINUE 10
    Accuracy 0.001
    Units LPS
    Headloss H-W
    `;
    const { issues } = parseInpWithEPS(inp);

    expect(issues).toBeNull();
  });

  it("says when override defaults aren't the same", () => {
    const inp = `
    [OPTIONS]
    Unbalanced\tContinue 20
    `;

    const { issues } = parseInpWithEPS(inp);

    expect(issues!.unbalancedDiff).toEqual({
      defaultSetting: "CONTINUE 10",
      customSetting: "CONTINUE 20",
    });
  });

  it("detects when the inp has been made by the app", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 1] })
      .build();
    let inp = buildInpEPS(hydraulicModel, {
      madeBy: true,
    });

    expect(parseInpWithEPS(inp).isMadeByApp).toBeTruthy();

    inp += ";some other stuff";

    expect(parseInpWithEPS(inp).isMadeByApp).toBeFalsy();
  });

  it("provides the count of items in each section", () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const head = 100;
    const lat = 10;
    const lng = 20;
    const inp = `
    [RESERVOIRS]
    ;ID\tHEAD
    ${IDS.R1}\t${head};__valuecomment

    [COORDINATES]
    ${IDS.R1}\t${lng}\t${lat};__anothercomment
    ${IDS.J1}\t1\t1

    [JUNCTIONS]
    ${IDS.J1}\t10
    [PIPES]
    ${IDS.P1}\t${IDS.R1}\t${IDS.J1}\t10\t10\t10\t10\tOpen;__anothercommnet
    `;

    const { stats } = parseInpWithEPS(inp);

    expect(stats.counts.get("[RESERVOIRS]")).toEqual(1);
    expect(stats.counts.get("[COORDINATES]")).toEqual(2);
    expect(stats.counts.get("[JUNCTIONS]")).toEqual(1);
    expect(stats.counts.get("[PIPES]")).toEqual(1);
  });

  it("skips links without coordinates", () => {
    const IDS = { J1: 1, J2: 2, V1: 3 } as const;
    const diameter = 10;
    const setting = 0.2;
    const type = "FCV";
    const minorLoss = 0.5;
    const anyNumber = 10;
    const inp = `
    [JUNCTIONS]
    ${IDS.J1}\t${anyNumber}
    ${IDS.J2}\t${anyNumber}
    [VALVES]
    ${IDS.V1}\t${IDS.J1}\t${IDS.J2}\t${diameter}\t${type}\t${setting}\t${minorLoss}

    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    const valve = getByLabel(hydraulicModel.assets, String(IDS.V1)) as Valve;
    expect(valve).toBeUndefined();
  });

  it("supports singular section names", () => {
    const IDS = { J1: 1, P1: 2, R1: 3 } as const;

    const inp = `
    [JUNCTION]
    ${IDS.J1} 100

    [PIPE]
    ${IDS.P1} ${IDS.R1} ${IDS.J1} 10 10 10 10 Open

    [RESERVOIR]
    ${IDS.R1} 200

    [COORDINATE]
    ${IDS.J1} 1 1
    ${IDS.R1} 2 2

    [DEMAND]
    ${IDS.J1} 0.5
    `;

    const { hydraulicModel } = parseInpWithEPS(inp);

    expect(hydraulicModel.assets.size).toEqual(3);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction).toBeDefined();
    expect(junction.elevation).toEqual(100);
    expect(junction.demands[0].baseDemand).toEqual(0.5);

    const pipe = getByLabel(hydraulicModel.assets, String(IDS.P1)) as Pipe;
    expect(pipe).toBeDefined();
    expect(pipe.length).toEqual(10);

    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir).toBeDefined();
    expect(reservoir.head).toEqual(200);
  });

  describe("section-specific issue reporting", () => {
    it("ignores empty [TAGS] section", () => {
      const inp = `
      [TAGS]
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[TAGS]")).toBeFalsy();
    });

    it("reports [TAGS] section with tag assignments", () => {
      const inp = `
      [TAGS]
      NODE J1 Tag1
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[TAGS]")).toBe(true);
    });

    it("ignores [ENERGY] section with default values", () => {
      const inp = `
      [ENERGY]
      Global Efficiency  75
      Global Price       0
      Demand Charge      0
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[ENERGY]")).toBeFalsy();
    });

    it("reports [ENERGY] section with non-default values", () => {
      const inp = `
      [ENERGY]
      Global Efficiency  80
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[ENERGY]")).toBe(true);
    });

    it("ignores [EMITTERS] section with zero values", () => {
      const inp = `
      [EMITTERS]
      J1  0
      J2  0.0
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[EMITTERS]")).toBeFalsy();
    });

    it("reports [EMITTERS] section with non-zero values", () => {
      const inp = `
      [EMITTERS]
      J1  0.5
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[EMITTERS]")).toBe(true);
    });

    it("ignores [REACTIONS] section with default values", () => {
      const inp = `
      [REACTIONS]
      Order Bulk            1
      Order Tank            1
      Order Wall            1
      Global Bulk           0
      Global Wall           0
      Limiting Potential    0
      Roughness Correlation 0
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[REACTIONS]")).toBeFalsy();
    });

    it("reports [REACTIONS] section with non-default values", () => {
      const inp = `
      [REACTIONS]
      Global Bulk  0.5
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[REACTIONS]")).toBe(true);
    });

    it("reports [REACTIONS] section with pipe-specific reactions", () => {
      const inp = `
      [REACTIONS]
      Bulk  P1  0.5
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[REACTIONS]")).toBe(true);
    });

    it("does not report [PATTERNS] as unsupported", () => {
      const inp = `
      [PATTERNS]
      PAT1  1.0  1.2  0.8  1.1
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.unsupportedSections?.has("[PATTERNS]")).toBeFalsy();
    });

    it("reports PCV valves with curves", () => {
      const inp = `
      [JUNCTIONS]
      J1  100
      J2  100

      [COORDINATES]
      J1  1  1
      J2  2  2

      [VALVES]
      V1  J1  J2  100  PCV  50  0  Curve1

      [CURVES]
      Curve1  10  5
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.hasPCVCurves).toBe(1);
    });

    it("does not report PCV valves without curves", () => {
      const inp = `
      [JUNCTIONS]
      J1  100
      J2  100

      [COORDINATES]
      J1  1  1
      J2  2  2

      [VALVES]
      V1  J1  J2  100  PCV  50  0
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.hasPCVCurves).toBeFalsy();
    });

    it("counts multiple PCV valves with curves", () => {
      const inp = `
      [JUNCTIONS]
      J1  100
      J2  100
      J3  100

      [COORDINATES]
      J1  1  1
      J2  2  2
      J3  3  3

      [VALVES]
      V1  J1  J2  100  PCV  50  0  Curve1
      V2  J2  J3  100  PCV  50  0  Curve2

      [CURVES]
      Curve1  10  5
      Curve2  20  10
      `;

      const { issues } = parseInpWithEPS(inp);

      expect(issues?.hasPCVCurves).toBe(2);
    });
  });
});
