import { parseInp } from "./parse-inp";
import { buildInp } from "src/simulation/build-inp";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Asset, AssetsMap } from "src/hydraulic-model";

describe("parse inactive assets", () => {
  it("parses commented junction as inactive", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    0
    ;J2   200    0

    [COORDINATES]
    J1    10    20
    ;J2   30    40
    `;

    const { hydraulicModel } = parseInp(inp, { inactiveAssets: true });

    const j1 = getByLabel(hydraulicModel.assets, "J1");
    const j2 = getByLabel(hydraulicModel.assets, "J2");

    expect(j1?.feature.properties.isActive).toBe(true);
    expect(j2?.feature.properties.isActive).toBe(false);
  });

  it("parses commented reservoir as inactive", () => {
    const inp = `
    [RESERVOIRS]
    R1    100
    ;R2   200

    [COORDINATES]
    R1    10    20
    ;R2   30    40
    `;

    const { hydraulicModel } = parseInp(inp, { inactiveAssets: true });

    const r1 = getByLabel(hydraulicModel.assets, "R1");
    const r2 = getByLabel(hydraulicModel.assets, "R2");

    expect(r1?.feature.properties.isActive).toBe(true);
    expect(r2?.feature.properties.isActive).toBe(false);
  });

  it("parses commented tank as inactive", () => {
    const inp = `
    [TANKS]
    T1    100    15    5    25    120    14    *    YES
    ;T2   200    20    10   30    150    20    *    NO

    [COORDINATES]
    T1    10    20
    ;T2   30    40
    `;

    const { hydraulicModel } = parseInp(inp, { inactiveAssets: true });

    const t1 = getByLabel(hydraulicModel.assets, "T1");
    const t2 = getByLabel(hydraulicModel.assets, "T2");

    expect(t1?.feature.properties.isActive).toBe(true);
    expect(t2?.feature.properties.isActive).toBe(false);
  });

  it("parses commented pipe as inactive", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    0
    J2    200    0

    [PIPES]
    P1    J1    J2    1000    300    130    0    OPEN
    ;P2   J2    J1    2000    400    140    0    OPEN

    [COORDINATES]
    J1    10    20
    J2    30    40
    `;

    const { hydraulicModel } = parseInp(inp, { inactiveAssets: true });

    const p1 = getByLabel(hydraulicModel.assets, "P1");
    const p2 = getByLabel(hydraulicModel.assets, "P2");

    expect(p1?.feature.properties.isActive).toBe(true);
    expect(p2?.feature.properties.isActive).toBe(false);
  });

  it("parses commented pump as inactive", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    0
    J2    200    0

    [PUMPS]
    PU1    J1    J2    POWER    100
    ;PU2   J2    J1    POWER    200

    [COORDINATES]
    J1    10    20
    J2    30    40
    `;

    const { hydraulicModel } = parseInp(inp, { inactiveAssets: true });

    const pu1 = getByLabel(hydraulicModel.assets, "PU1");
    const pu2 = getByLabel(hydraulicModel.assets, "PU2");

    expect(pu1?.feature.properties.isActive).toBe(true);
    expect(pu2?.feature.properties.isActive).toBe(false);
  });

  it("parses commented valve as inactive", () => {
    const inp = `
    [JUNCTIONS]
    J1    100    0
    J2    200    0

    [VALVES]
    V1    J1    J2    300    TCV    0    0
    ;V2   J2    J1    400    PRV    50   0

    [COORDINATES]
    J1    10    20
    J2    30    40
    `;

    const { hydraulicModel } = parseInp(inp, { inactiveAssets: true });

    const v1 = getByLabel(hydraulicModel.assets, "V1");
    const v2 = getByLabel(hydraulicModel.assets, "V2");

    expect(v1?.feature.properties.isActive).toBe(true);
    expect(v2?.feature.properties.isActive).toBe(false);
  });

  it("round-trips inactive assets with comment option", () => {
    const builder = new HydraulicModelBuilder();

    builder.aJunction(1, {
      label: "J1",
      elevation: 100,
      coordinates: [10, 20],
    });
    builder.aJunction(2, {
      label: "J2",
      elevation: 200,
      coordinates: [30, 40],
      isActive: false,
    });
    builder.aPipe(3, {
      label: "P1",
      startNodeId: 1,
      endNodeId: 2,
      length: 1000,
      diameter: 300,
      roughness: 130,
    });
    builder.aPipe(4, {
      label: "P2",
      startNodeId: 2,
      endNodeId: 1,
      length: 2000,
      diameter: 400,
      roughness: 140,
      isActive: false,
    });

    const hydraulicModel = builder.build();

    // Generate INP with inactive assets as comments
    const inp = buildInp(hydraulicModel, {
      inactiveAssets: true,
      geolocation: true,
    });

    // Verify INP contains commented lines
    expect(inp).toContain(";2"); // J2 will be output as ;2
    expect(inp).toContain(";4"); // P2 will be output as ;4
    expect(inp).toMatch(/^1\t/m); // J1 should appear as active (as "1")
    expect(inp).toMatch(/^3\t/m); // P1 should appear as active (as "3")

    // Parse back and verify isActive property
    const { hydraulicModel: parsedModel } = parseInp(inp, {
      inactiveAssets: true,
    });

    const parsedJ1 = getByLabel(parsedModel.assets, "1"); // Labels are numeric IDs
    const parsedJ2 = getByLabel(parsedModel.assets, "2");
    const parsedP1 = getByLabel(parsedModel.assets, "3");
    const parsedP2 = getByLabel(parsedModel.assets, "4");

    expect(parsedJ1?.feature.properties.isActive).toBe(true);
    expect(parsedJ2?.feature.properties.isActive).toBe(false);
    expect(parsedP1?.feature.properties.isActive).toBe(true);
    expect(parsedP2?.feature.properties.isActive).toBe(false);
  });

  it("skips inactive assets when by default", () => {
    const builder = new HydraulicModelBuilder();

    builder.aJunction(1, {
      label: "J1",
      elevation: 100,
      coordinates: [10, 20],
    });
    builder.aJunction(2, {
      label: "J2",
      elevation: 200,
      coordinates: [30, 40],
    });
    builder.aPipe(3, {
      label: "P1",
      startNodeId: 1,
      endNodeId: 2,
      length: 1000,
      diameter: 300,
      roughness: 130,
      isActive: true,
    });
    builder.aJunction(4, {
      label: "J3",
      elevation: 200,
      coordinates: [10, 20],
      isActive: false,
    });

    const hydraulicModel = builder.build();

    // Generate INP with inactive assets excluded (default)
    const inp = buildInp(hydraulicModel);

    expect(inp).not.toMatch(/^4\t/m); // J3 should not appear
    expect(inp).toMatch(/^1\t/m); // J1 should appear
    expect(inp).toMatch(/^2\t/m); // J2 should appear
    expect(inp).toMatch(/^3\t/m); // P1 should appear
  });

  it("handles mixed active and inactive assets in same section", () => {
    const inp = `[JUNCTIONS]
J1    100    0
;J2   200    0
J3    300    0
;J4   400    0
J5    500    0

[COORDINATES]
J1    10    20
;J2   30    40
J3    50    60
;J4   70    80
J5    90    10
`;

    const { hydraulicModel } = parseInp(inp, { inactiveAssets: true });

    const j1 = getByLabel(hydraulicModel.assets, "J1");
    const j2 = getByLabel(hydraulicModel.assets, "J2");
    const j3 = getByLabel(hydraulicModel.assets, "J3");
    const j4 = getByLabel(hydraulicModel.assets, "J4");
    const j5 = getByLabel(hydraulicModel.assets, "J5");

    expect(j1?.feature.properties.isActive).toBe(true);
    expect(j2?.feature.properties.isActive).toBe(false);
    expect(j3?.feature.properties.isActive).toBe(true);
    expect(j4?.feature.properties.isActive).toBe(false);
    expect(j5?.feature.properties.isActive).toBe(true);
  });

  it("ignores header comment lines in sections", () => {
    const inp = `
    [JUNCTIONS]
    ;ID   Elev.  Demand
    ;---------------------
    J1    100    0
    ;J2   200    0

    [COORDINATES]
    J1    10    20
    ;J2   30    40
    `;

    const { hydraulicModel, issues } = parseInp(inp, { inactiveAssets: true });

    const assets = [...hydraulicModel.assets.values()];
    expect(assets).toHaveLength(2);

    const j1 = getByLabel(hydraulicModel.assets, "J1");
    const j2 = getByLabel(hydraulicModel.assets, "J2");

    expect(j1?.feature.properties.isActive).toBe(true);
    expect(j2?.feature.properties.isActive).toBe(false);

    // Should not create assets with IDs like "ID" from header
    expect(issues?.nodesMissingCoordinates?.has("ID") || false).toBe(false);
  });
});

const getByLabel = (assets: AssetsMap, label: string): Asset | undefined => {
  return [...assets.values()].find((a) => a.label === label);
};
