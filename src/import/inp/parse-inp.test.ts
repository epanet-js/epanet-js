import { Junction, Pipe, Pump, Reservoir, Tank } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp, chooseUnitSystem } from "src/simulation/build-inp";
import { presets } from "src/lib/project-settings/quantities-spec";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { getByLabel } from "src/__helpers__/asset-queries";
import { Valve } from "src/hydraulic-model/asset-types";

describe("Parse inp with", () => {
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

    const { hydraulicModel } = parseInp(inp);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction.elevation).toEqual(elevation);
    expect(
      hydraulicModel.demands.junctions.get(junction.id)![0].baseDemand,
    ).toEqual(demand);
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

    const { hydraulicModel } = parseInp(inp);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction.elevation).toEqual(elevation);
    expect(
      hydraulicModel.demands.junctions.get(junction.id)![0].baseDemand,
    ).toEqual(demand);
    expect(junction.coordinates).toEqual([20, 10]);

    const otherJunction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J2),
    ) as Junction;
    expect(otherJunction.elevation).toEqual(otherElevation);
    expect(
      hydraulicModel.demands.junctions.get(otherJunction.id)![0].baseDemand,
    ).toEqual(otherDemand);
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

    const { hydraulicModel } = parseInp(inp);

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

    const { hydraulicModel } = parseInp(inp);

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
    const { projectSettings } = parseInp(inp);
    expect(projectSettings.units).toMatchObject({
      flow: "gal/min",
    });
    expect(projectSettings.units.head).toEqual("ft");
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
    const { projectSettings } = parseInp(inp);
    expect(projectSettings.units).toMatchObject({
      flow: "l/s",
    });
    expect(projectSettings.units.head).toEqual("m");
  });

  it("parses pressure unit override from OPTIONS", () => {
    const IDS = { R1: 1 } as const;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t100
    [OPTIONS]
    Units\tLPS
    Pressure\tKPA
    [COORDINATES]
    ${IDS.R1}\t1\t1
    `;
    const { projectSettings } = parseInp(inp);
    expect(projectSettings.units.pressure).toEqual("kPa");
  });

  it("keeps default pressure unit when no PRESSURE option", () => {
    const IDS = { R1: 1 } as const;
    const inp = `
    [RESERVOIRS]
    ${IDS.R1}\t100
    [OPTIONS]
    Units\tLPS
    [COORDINATES]
    ${IDS.R1}\t1\t1
    `;
    const { projectSettings } = parseInp(inp);
    expect(projectSettings.units.pressure).toEqual("mwc");
  });

  it("detects headloss formula from inp", () => {
    const inp = `
    [OPTIONS]
    ANY
    Units\tLPS
    Headloss\tD-W
    ANY
    `;

    const { projectSettings } = parseInp(inp);

    expect(projectSettings.headlossFormula).toEqual("D-W");
  });

  it("says when inp contains unsupported sections", () => {
    const inp = `
    [MIXING]
    ANY
    [NEW]
    `;

    const { issues } = parseInp(inp);

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

    const { issues } = parseInp(inp);

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
    } = parseInp(inp);

    expect(issues!.nodesMissingCoordinates!.values()).toContain(String(IDS.J1));
    expect(getByLabel(assets, String(IDS.J1))).toBeUndefined();
    expect(getByLabel(assets, String(IDS.J2))).not.toBeUndefined();
  });

  it("accepts out-of-bounds coordinates with unknown projection status", () => {
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

    const { hydraulicModel, projectionStatus } = parseInp(inp);

    expect(projectionStatus).toBe("unknown");
    expect(hydraulicModel.assets.get(IDS.J1)).toBeDefined();
  });

  it("accepts out-of-bounds vertices with unknown projection status", () => {
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

    const { hydraulicModel, projectionStatus } = parseInp(inp);

    expect(projectionStatus).toBe("unknown");
    expect(getByLabel(hydraulicModel.assets, String(IDS.P1))).toBeDefined();
  });

  it("parses non default options", () => {
    const inp = `
    [OPTIONS]
    Specific Gravity\t2
    Tolerance\t0.00001
    DIFFUSIVITY\t1.0
    TANK MIXING\tMIXED
    Quality\tNONE
    `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.specificGravity).toBe(2);
    expect(simulationSettings.tolerance).toBe(0.00001);
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
    const { issues } = parseInp(inp);

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
    const { projectSettings, issues } = parseInp(inp);

    expect(issues).toBeNull();
    expect(chooseUnitSystem(projectSettings.units)).toEqual("MGD");
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
    const { issues } = parseInp(inp);

    expect(issues).toBeNull();
  });

  it("parses unbalanced with extra trials", () => {
    const inp = `
    [OPTIONS]
    Unbalanced\tContinue 20
    `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.unbalancedMode).toBe("CONTINUE");
    expect(simulationSettings.unbalancedExtraTrials).toBe(20);
  });

  it("detects when the inp has been made by the app", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 1] })
      .build();
    let inp = buildInp(hydraulicModel, {
      simulationSettings: defaultSimulationSettings,
      units: presets.LPS.units,
      madeBy: true,
    });

    expect(parseInp(inp).isMadeByApp).toBeTruthy();

    inp += ";some other stuff";

    expect(parseInp(inp).isMadeByApp).toBeFalsy();
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

    const { stats } = parseInp(inp);

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

    const { hydraulicModel } = parseInp(inp);

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

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.assets.size).toEqual(3);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction).toBeDefined();
    expect(junction.elevation).toEqual(100);
    expect(
      hydraulicModel.demands.junctions.get(junction.id)![0].baseDemand,
    ).toEqual(0.5);

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

  it("supports case-insensitive section names", () => {
    const IDS = { J1: 1, R1: 2, P1: 3 } as const;

    const inp = `
    [junctions]
    ${IDS.J1} 100

    [Reservoirs]
    ${IDS.R1} 200

    [PIPES]
    ${IDS.P1} ${IDS.R1} ${IDS.J1} 10 10 10 10 Open

    [coordinates]
    ${IDS.J1} 1 1
    ${IDS.R1} 2 2

    [Demands]
    ${IDS.J1} 0.5

    [end]
    `;

    const { hydraulicModel } = parseInp(inp);

    expect(hydraulicModel.assets.size).toEqual(3);

    const junction = getByLabel(
      hydraulicModel.assets,
      String(IDS.J1),
    ) as Junction;
    expect(junction).toBeDefined();
    expect(junction.elevation).toEqual(100);
    expect(
      hydraulicModel.demands.junctions.get(junction.id)![0].baseDemand,
    ).toEqual(0.5);

    const reservoir = getByLabel(
      hydraulicModel.assets,
      String(IDS.R1),
    ) as Reservoir;
    expect(reservoir).toBeDefined();
    expect(reservoir.head).toEqual(200);

    const pipe = getByLabel(hydraulicModel.assets, String(IDS.P1)) as Pipe;
    expect(pipe).toBeDefined();
  });

  describe("section-specific issue reporting", () => {
    it("ignores empty [TAGS] section", () => {
      const inp = `
      [TAGS]
      `;

      const { issues } = parseInp(inp);

      expect(issues?.unsupportedSections?.has("[TAGS]")).toBeFalsy();
    });

    it("reports [TAGS] section with tag assignments", () => {
      const inp = `
      [TAGS]
      NODE J1 Tag1
      `;

      const { issues } = parseInp(inp);

      expect(issues?.unsupportedSections?.has("[TAGS]")).toBe(true);
    });

    it("ignores [ENERGY] section with default values", () => {
      const inp = `
      [ENERGY]
      Global Efficiency  75
      Global Price       0
      Demand Charge      0
      `;

      const { issues } = parseInp(inp);

      expect(issues?.unsupportedSections?.has("[ENERGY]")).toBeFalsy();
    });

    it("parses [ENERGY] section with non-default values", () => {
      const inp = `
      [ENERGY]
      Global Efficiency  80
      `;

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.energyGlobalEfficiency).toBe(80);
    });

    it("ignores [EMITTERS] section with zero values", () => {
      const inp = `
      [EMITTERS]
      J1  0
      J2  0.0
      `;

      const { issues } = parseInp(inp);

      expect(issues?.unsupportedSections?.has("[EMITTERS]")).toBeFalsy();
    });

    it("parses [EMITTERS] section", () => {
      const inp = `
      [JUNCTIONS]
      J1  100
      J2  200

      [COORDINATES]
      J1  10  20
      J2  30  40

      [EMITTERS]
      J1  0.5
      `;

      const { hydraulicModel, issues } = parseInp(inp);
      const j1 = getByLabel(hydraulicModel.assets, "J1") as Junction;
      const j2 = getByLabel(hydraulicModel.assets, "J2") as Junction;

      expect(j1.emitterCoefficient).toBe(0.5);
      expect(j2.emitterCoefficient).toBe(0);
      expect(issues?.unsupportedSections?.has("[EMITTERS]")).toBeFalsy();
    });

    it("parses [REACTIONS] section with non-default values", () => {
      const inp = `
      [REACTIONS]
      Global Bulk  0.5
      `;

      const { simulationSettings } = parseInp(inp);

      expect(simulationSettings.reactionGlobalBulk).toBe(0.5);
    });

    it("parses per-pipe BULK and WALL coefficients when waterChemical is on", () => {
      const inp = `
      [JUNCTIONS]
      J1    100
      J2    200

      [TANKS]
      T1    50    10    0    20    15    0

      [PIPES]
      P1    J1    J2    1000    100    100    0    Open

      [COORDINATES]
      J1    0    0
      J2    1    1
      T1    1    1

      [REACTIONS]
      Bulk  P1  -0.5
      Wall  P1  -1.0
      Tank  T1  -0.3

      [END]
    `;

      const { hydraulicModel } = parseInp(inp, {
        waterChemical: true,
      });
      const p1 = getByLabel(hydraulicModel.assets, "P1") as Pipe;
      const t1 = getByLabel(hydraulicModel.assets, "T1") as Tank;

      expect(t1.bulkReactionCoeff).toBe(-0.3);
      expect(p1.bulkReactionCoeff).toBe(-0.5);
      expect(p1.wallReactionCoeff).toBe(-1.0);
    });

    it("reports [REACTIONS] section with pipe-specific reactions", () => {
      const inp = `
      [REACTIONS]
      Bulk  P1  0.5
      `;

      const { issues } = parseInp(inp);

      expect(issues?.unsupportedSections?.has("[REACTIONS]")).toBe(true);
    });
  });

  describe("projection detection", () => {
    it("returns projectionStatus wgs84 when coordinates are valid", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const inp = `
      [JUNCTIONS]
      ${IDS.J1}  100
      ${IDS.J2}  200

      [PIPES]
      ${IDS.P1}  ${IDS.J1}  ${IDS.J2}  1000  100  100  0  Open

      [COORDINATES]
      ${IDS.J1}  10  20
      ${IDS.J2}  11  21
      `;

      const result = parseInp(inp);

      expect(result.projectionStatus).toBe("wgs84");
      expect(result.hydraulicModel.assets.size).toBe(3);
    });

    it("returns projectionStatus unknown when coordinates are out of bounds", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const inp = `
      [JUNCTIONS]
      ${IDS.J1}  100
      ${IDS.J2}  200

      [PIPES]
      ${IDS.P1}  ${IDS.J1}  ${IDS.J2}  1000  100  100  0  Open

      [COORDINATES]
      ${IDS.J1}  500000  200000
      ${IDS.J2}  501000  201000
      `;

      const result = parseInp(inp);

      expect(result.projectionStatus).toBe("unknown");
      expect(result.hydraulicModel.assets.size).toBe(3);
    });

    it("parses all assets including vertices when projectionStatus is unknown", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const inp = `
      [JUNCTIONS]
      ${IDS.J1}  100
      ${IDS.J2}  200

      [PIPES]
      ${IDS.P1}  ${IDS.J1}  ${IDS.J2}  1000  100  100  0  Open

      [COORDINATES]
      ${IDS.J1}  500000  200000
      ${IDS.J2}  501000  201000

      [VERTICES]
      ${IDS.P1}  500500  200500
      `;

      const result = parseInp(inp);

      expect(result.projectionStatus).toBe("unknown");
      const pipe = getByLabel(
        result.hydraulicModel.assets,
        String(IDS.P1),
      ) as Pipe;
      expect(pipe).toBeDefined();
      expect(pipe.coordinates).toHaveLength(3);
      expect(pipe.coordinates[1]).toEqual([500500, 200500]);
    });

    it("uses header projection when available", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [10, 20] })
        .aJunction(IDS.J2, { coordinates: [11, 21] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();
      const inp = buildInp(hydraulicModel, {
        simulationSettings: defaultSimulationSettings,
        units: presets.LPS.units,
        madeBy: true,
        projection: {
          type: "xy-grid",
          id: "xy-grid",
          name: "XY Grid",
          centroid: [500000, 200000],
        },
      });

      const result = parseInp(inp);

      expect(result.isMadeByApp).toBe(true);
      expect(result.projectionStatus).toBeUndefined();
      expect(result.projectSettings.projection.type).toBe("xy-grid");
    });

    it("does not report invalidCoordinates or invalidVertices issues", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const inp = `
      [JUNCTIONS]
      ${IDS.J1}  100
      ${IDS.J2}  200

      [PIPES]
      ${IDS.P1}  ${IDS.J1}  ${IDS.J2}  1000  100  100  0  Open

      [COORDINATES]
      ${IDS.J1}  500000  200000
      ${IDS.J2}  501000  201000

      [VERTICES]
      ${IDS.P1}  500500  200500
      `;

      const result = parseInp(inp);
      expect(result.issues?.invalidCoordinates).toBeUndefined();
      expect(result.issues?.invalidVertices).toBeUndefined();
    });
  });

  describe("non-projected import", () => {
    it("sets projection to wgs84 for standard import", () => {
      const inp = `
      [JUNCTIONS]
      J1  100

      [COORDINATES]
      J1  10  20
      `;

      const result = parseInp(inp);
      expect(result.projectSettings.projection.type).toBe("wgs84");
    });
  });
});

describe("water quality options", () => {
  it("parses QUALITY NONE", () => {
    const inp = `
      [OPTIONS]
      Quality\tNONE
      `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.qualitySimulationType).toEqual("none");
  });

  it("parses QUALITY AGE", () => {
    const inp = `
      [OPTIONS]
      Quality\tAGE
      `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.qualitySimulationType).toEqual("age");
  });

  it("parses QUALITY TRACE with node ID", () => {
    const inp = `
      [JUNCTIONS]
      Tank23\t100
      [COORDINATES]
      Tank23\t0\t0
      [OPTIONS]
      Quality\tTRACE Tank23
      `;

    const { simulationSettings, hydraulicModel } = parseInp(inp);

    expect(simulationSettings.qualitySimulationType).toEqual("trace");
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

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.qualitySimulationType).toEqual("trace");
    expect(simulationSettings.qualityTraceNodeId).toBeNull();
  });

  it("parses QUALITY CHEMICAL with name and units", () => {
    const inp = `
      [OPTIONS]
      Quality\tChlorine mg/L
      `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.qualitySimulationType).toEqual("chemical");
    expect(simulationSettings.qualityChemicalName).toEqual("Chlorine");
    expect(simulationSettings.qualityMassUnit).toEqual("mg/L");
  });

  it("parses QUALITY CHEMICAL keyword as empty chemical name", () => {
    const inp = `
      [OPTIONS]
      Quality\tCHEMICAL mg/L
      `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.qualitySimulationType).toEqual("chemical");
    expect(simulationSettings.qualityChemicalName).toEqual("");
    expect(simulationSettings.qualityMassUnit).toEqual("mg/L");
  });

  it("parses QUALITY chemical keyword case-insensitively as empty chemical name", () => {
    const inp = `
      [OPTIONS]
      Quality\tchemical mg/L
      `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.qualitySimulationType).toEqual("chemical");
    expect(simulationSettings.qualityChemicalName).toEqual("");
  });

  it("parses QUALITY CHEMICAL with ug/L unit", () => {
    const inp = `
      [OPTIONS]
      Quality\tFluoride ug/L
      `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.qualitySimulationType).toEqual("chemical");
    expect(simulationSettings.qualityChemicalName).toEqual("Fluoride");
    expect(simulationSettings.qualityMassUnit).toEqual("ug/L");
  });

  it("parses TOLERANCE", () => {
    const inp = `
      [OPTIONS]
      Tolerance\t0.05
      `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.tolerance).toEqual(0.05);
  });

  it("parses DIFFUSIVITY", () => {
    const inp = `
      [OPTIONS]
      Diffusivity\t2.0
      `;

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.diffusivity).toEqual(2.0);
  });
});

describe("reaction options", () => {
  it("parses reaction settings", () => {
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

    const { simulationSettings } = parseInp(inp);

    expect(simulationSettings.reactionBulkOrder).toEqual(2);
    expect(simulationSettings.reactionWallOrder).toEqual(0);
    expect(simulationSettings.reactionTankOrder).toEqual(1);
    expect(simulationSettings.reactionGlobalBulk).toEqual(-0.5);
    expect(simulationSettings.reactionGlobalWall).toEqual(-1.0);
    expect(simulationSettings.reactionLimitingPotential).toEqual(0.5);
    expect(simulationSettings.reactionRoughnessCorrelation).toEqual(0.1);
  });

  it("does not report reactions as unsupported", () => {
    const inp = `
      [REACTIONS]
      Global Bulk\t-0.5
      `;

    const { issues } = parseInp(inp);

    expect(issues?.unsupportedSections?.has("[REACTIONS]")).toBeFalsy();
  });

  it("still reports pipe-specific reactions as unsupported", () => {
    const inp = `
      [REACTIONS]
      Bulk  P1  0.5
      `;

    const { issues } = parseInp(inp);

    expect(issues?.unsupportedSections?.has("[REACTIONS]")).toBe(true);
  });
});

describe("quality section", () => {
  it("parses initial water age from QUALITY section when quality type is AGE", () => {
    const inp = `
      [JUNCTIONS]
      J1    100
      J2    200

      [COORDINATES]
      J1    0    0
      J2    1    1

      [OPTIONS]
      Quality\tAGE

      [QUALITY]
      J1    5.0
      J2    12.5

      [END]
    `;

    const { hydraulicModel } = parseInp(inp, { waterAge: true });
    const j1 = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const j2 = getByLabel(hydraulicModel.assets, "J2") as Junction;

    expect(j1.initialQuality).toBe(5.0);
    expect(j2.initialQuality).toBe(12.5);
  });

  it("reads QUALITY section values regardless of quality type", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [COORDINATES]
      J1    0    0

      [OPTIONS]
      Quality\tChlorine mg/L

      [QUALITY]
      J1    1.5

      [END]
    `;

    const { hydraulicModel } = parseInp(inp, { waterAge: true });
    const j1 = getByLabel(hydraulicModel.assets, "J1") as Junction;

    expect(j1.initialQuality).toBe(1.5);
  });

  it("reads QUALITY section even when waterAge option is off", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [COORDINATES]
      J1    0    0

      [OPTIONS]
      Quality\tAGE

      [QUALITY]
      J1    5.0

      [END]
    `;

    const { hydraulicModel } = parseInp(inp, { waterAge: false });
    const j1 = getByLabel(hydraulicModel.assets, "J1") as Junction;

    expect(j1.initialQuality).toBe(5.0);
  });

  it("skips zero values in QUALITY section", () => {
    const inp = `
      [JUNCTIONS]
      J1    100
      J2    200

      [COORDINATES]
      J1    0    0
      J2    1    1

      [OPTIONS]
      Quality\tAGE

      [QUALITY]
      J1    0
      J2    10

      [END]
    `;

    const { hydraulicModel } = parseInp(inp, { waterAge: true });
    const j1 = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const j2 = getByLabel(hydraulicModel.assets, "J2") as Junction;

    expect(j1.initialQuality).toBe(0);
    expect(j2.initialQuality).toBe(10);
  });

  it("parses initial water age for tanks and reservoirs", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [TANKS]
      T1    50    10    0    20    15    0

      [RESERVOIRS]
      R1    100

      [COORDINATES]
      J1    0    0
      T1    1    1
      R1    2    2

      [OPTIONS]
      Quality\tAGE

      [QUALITY]
      T1    8.0
      R1    3.0

      [END]
    `;

    const { hydraulicModel } = parseInp(inp, { waterAge: true });
    const t1 = getByLabel(hydraulicModel.assets, "T1") as Tank;
    const r1 = getByLabel(hydraulicModel.assets, "R1") as Reservoir;

    expect(t1.initialQuality).toBe(8.0);
    expect(r1.initialQuality).toBe(3.0);
  });

  it("reports water quality type issue when waterAge is off", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [COORDINATES]
      J1    0    0

      [OPTIONS]
      Quality\tAGE

      [QUALITY]
      J1    5.0

      [END]
    `;

    const { issues } = parseInp(inp, { waterAge: false });

    expect(issues?.waterQualityType).toBe("age");
    expect(issues?.unsupportedSections?.has("[QUALITY]")).toBeFalsy();
  });

  it("accepts TRACE quality type when waterTrace option is on", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [COORDINATES]
      J1    0    0

      [OPTIONS]
      Quality\tTRACE J1

      [END]
    `;

    const { issues, simulationSettings } = parseInp(inp, {
      waterTrace: true,
    });

    expect(simulationSettings.qualitySimulationType).toEqual("trace");
    expect(issues?.waterQualityType).toBeUndefined();
  });

  it("reports TRACE quality type issue when waterTrace is off", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [COORDINATES]
      J1    0    0

      [OPTIONS]
      Quality\tTRACE J1

      [END]
    `;

    const { issues } = parseInp(inp, { waterTrace: false });

    expect(issues?.waterQualityType).toBe("trace");
  });

  it("does not report QUALITY as unsupported when waterAge is on", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [COORDINATES]
      J1    0    0

      [OPTIONS]
      Quality\tAGE

      [QUALITY]
      J1    5.0

      [END]
    `;

    const { issues } = parseInp(inp, { waterAge: true });

    expect(issues?.unsupportedSections?.has("[QUALITY]")).toBeFalsy();
  });

  it("parses initial chemical concentration for tanks and reservoirs", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [TANKS]
      T1    50    10    0    20    15    0

      [RESERVOIRS]
      R1    100

      [COORDINATES]
      J1    0    0
      T1    1    1
      R1    2    2

      [OPTIONS]
      Quality\tChlorine mg/L

      [QUALITY]
      T1    0.5
      R1    1.0

      [END]
    `;

    const { hydraulicModel, simulationSettings, issues } = parseInp(inp, {
      waterChemical: true,
    });
    const t1 = getByLabel(hydraulicModel.assets, "T1") as Tank;
    const r1 = getByLabel(hydraulicModel.assets, "R1") as Reservoir;

    expect(t1.initialQuality).toBe(0.5);
    expect(r1.initialQuality).toBe(1.0);
    expect(simulationSettings.qualitySimulationType).toEqual("chemical");
    expect(issues?.waterQualityType).toBeUndefined();
  });

  it("reads QUALITY section values even when waterChemical is off", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [COORDINATES]
      J1    0    0

      [OPTIONS]
      Quality\tChlorine mg/L

      [QUALITY]
      J1    1.5

      [END]
    `;

    const { hydraulicModel, issues } = parseInp(inp, { waterChemical: false });
    const j1 = getByLabel(hydraulicModel.assets, "J1") as Junction;

    expect(j1.initialQuality).toBe(1.5);
    expect(issues?.waterQualityType).toBe("chemical");
  });
});

describe("chemical sources", () => {
  it("parses SOURCES section when waterChemical is on", () => {
    const inp = `
      [JUNCTIONS]
      J1    100
      J2    200

      [COORDINATES]
      J1    0    0
      J2    1    1

      [OPTIONS]
      Quality\tChlorine mg/L

      [SOURCES]
      J1    CONCEN    1.2    Pat1
      J2    MASS      12

      [PATTERNS]
      Pat1    1.0    1.5

      [END]
    `;

    const { hydraulicModel } = parseInp(inp, { waterChemical: true });
    const j1 = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const j2 = getByLabel(hydraulicModel.assets, "J2") as Junction;

    expect(j1.chemicalSourceType).toBe("CONCEN");
    expect(j1.chemicalSourceStrength).toBe(1.2);
    expect(j1.chemicalSourcePatternId).toBeDefined();
    expect(j2.chemicalSourceType).toBe("MASS");
    expect(j2.chemicalSourceStrength).toBe(12);
    expect(j2.chemicalSourcePatternId).toBeUndefined();
  });

  it("reports SOURCES as unsupported when waterChemical is off", () => {
    const inp = `
      [JUNCTIONS]
      J1    100

      [COORDINATES]
      J1    0    0

      [SOURCES]
      J1    CONCEN    1.2

      [END]
    `;

    const { issues, hydraulicModel } = parseInp(inp, {
      waterChemical: false,
    });
    const j1 = getByLabel(hydraulicModel.assets, "J1") as Junction;

    expect(issues?.unsupportedSections?.has("[SOURCES]")).toBe(true);
    expect(j1.chemicalSourceType).toBeUndefined();
  });
});

describe("populateAssetIndex", () => {
  const networkInp = `
    [JUNCTIONS]
    J1\t100
    J2\t200

    [RESERVOIRS]
    R1\t50

    [TANKS]
    T1\t50\t10\t0\t20\t15\t0

    [PIPES]
    P1\tJ1\tJ2\t100\t10\t100\t0\tOpen

    [PUMPS]
    PU1\tR1\tJ1

    [VALVES]
    V1\tJ1\tJ2\t10\tTCV\t0\t0

    [COORDINATES]
    J1\t1\t1
    J2\t2\t2
    R1\t3\t3
    T1\t4\t4
  `;

  it("populates asset index when enabled", () => {
    const { hydraulicModel } = parseInp(networkInp, {
      populateAssetIndex: true,
    });

    const j1 = getByLabel(hydraulicModel.assets, "J1") as Junction;
    const j2 = getByLabel(hydraulicModel.assets, "J2") as Junction;
    const r1 = getByLabel(hydraulicModel.assets, "R1") as Reservoir;
    const t1 = getByLabel(hydraulicModel.assets, "T1") as Tank;
    const p1 = getByLabel(hydraulicModel.assets, "P1") as Pipe;
    const pu1 = getByLabel(hydraulicModel.assets, "PU1") as Pump;
    const v1 = getByLabel(hydraulicModel.assets, "V1") as Valve;

    expect(hydraulicModel.assetIndex.hasNode(j1.id)).toBe(true);
    expect(hydraulicModel.assetIndex.hasNode(j2.id)).toBe(true);
    expect(hydraulicModel.assetIndex.hasNode(r1.id)).toBe(true);
    expect(hydraulicModel.assetIndex.hasNode(t1.id)).toBe(true);
    expect(hydraulicModel.assetIndex.hasLink(p1.id)).toBe(true);
    expect(hydraulicModel.assetIndex.hasLink(pu1.id)).toBe(true);
    expect(hydraulicModel.assetIndex.hasLink(v1.id)).toBe(true);
    expect(hydraulicModel.assetIndex.nodeCount).toBe(4);
    expect(hydraulicModel.assetIndex.linkCount).toBe(3);
  });

  it("does not populate asset index when disabled", () => {
    const { hydraulicModel } = parseInp(networkInp, {
      populateAssetIndex: false,
    });

    expect(hydraulicModel.assetIndex.nodeCount).toBe(0);
    expect(hydraulicModel.assetIndex.linkCount).toBe(0);
  });

  it("registers labels during parsing", () => {
    const { factories } = parseInp(networkInp);

    expect(factories.labelManager.getIdByLabel("J1", "junction")).toBeDefined();
    expect(factories.labelManager.getIdByLabel("J2", "junction")).toBeDefined();
    expect(
      factories.labelManager.getIdByLabel("R1", "reservoir"),
    ).toBeDefined();
    expect(factories.labelManager.getIdByLabel("T1", "tank")).toBeDefined();
    expect(factories.labelManager.getIdByLabel("P1", "pipe")).toBeDefined();
    expect(factories.labelManager.getIdByLabel("PU1", "pump")).toBeDefined();
    expect(factories.labelManager.getIdByLabel("V1", "valve")).toBeDefined();
  });
});
