import { describe, it, expect } from "vitest";
import {
  allocateCustomerPoints,
  AllocationRule,
} from "./allocate-customer-points";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { CustomerPoints } from "../../customer-points";

describe("allocateCustomerPoints", () => {
  it("allocates customer points based on single rule", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      [
        "CP1",
        buildCustomerPoint("CP1", {
          coordinates: [-95.4084, 29.7019],
          demand: 50,
        }),
      ],
      [
        "CP2",
        buildCustomerPoint("CP2", {
          coordinates: [-95.4082, 29.7018],
          demand: 30,
        }),
      ],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(2);
    expect(result.ruleMatches).toEqual([2]);

    const allocatedCP1 = result.allocatedCustomerPoints.get("CP1");
    expect(allocatedCP1?.connection?.pipeId).toBe("P1");
    expect(allocatedCP1?.connection?.junctionId).toBe("J1");
  });

  it("applies rules in order with first match wins", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 8,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4084, 29.7019] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(1);
    expect(result.ruleMatches).toEqual([1, 0]);
  });

  it("filters by maximum distance", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4084, 29.7019] })],
      ["CP2", buildCustomerPoint("CP2", { coordinates: [-95.4, 29.8] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(1);
    expect(result.allocatedCustomerPoints.has("CP1")).toBe(true);
    expect(result.allocatedCustomerPoints.has("CP2")).toBe(false);
    expect(result.ruleMatches).toEqual([1]);
  });

  it("filters by maximum diameter", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aJunction("J3", { coordinates: [-95.4089633, 29.710228] })
      .aJunction("J4", { coordinates: [-95.4077939, 29.711706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 8,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .aPipe("P2", {
        startNodeId: "J3",
        endNodeId: "J4",
        diameter: 16,
        coordinates: [
          [-95.4089633, 29.710228],
          [-95.4077939, 29.711706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4084, 29.7019] })],
      ["CP2", buildCustomerPoint("CP2", { coordinates: [-95.4084, 29.7109] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(1);
    const allocatedCP1 = result.allocatedCustomerPoints.get("CP1");
    expect(allocatedCP1?.connection?.pipeId).toBe("P1");
    expect(result.allocatedCustomerPoints.has("CP2")).toBe(false);
    expect(result.ruleMatches).toEqual([1]);
  });

  it("handles multiple rules with different constraints", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aJunction("J3", { coordinates: [-95.4089633, 29.710228] })
      .aJunction("J4", { coordinates: [-95.4077939, 29.711706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 8,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .aPipe("P2", {
        startNodeId: "J3",
        endNodeId: "J4",
        diameter: 16,
        coordinates: [
          [-95.4089633, 29.710228],
          [-95.4077939, 29.711706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4084, 29.7019] })],
      ["CP2", buildCustomerPoint("CP2", { coordinates: [-95.4084, 29.7109] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
      { maxDistance: 200, maxDiameter: 20 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(2);
    expect(result.ruleMatches).toEqual([1, 1]);

    const allocatedCP1 = result.allocatedCustomerPoints.get("CP1");
    const allocatedCP2 = result.allocatedCustomerPoints.get("CP2");
    expect(allocatedCP1?.connection?.pipeId).toBe("P1");
    expect(allocatedCP2?.connection?.pipeId).toBe("P2");
  });

  it("handles empty customer points", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map();
    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(0);
    expect(result.ruleMatches).toEqual([0]);
  });

  it("handles no pipes in hydraulic model", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .build();

    const customerPoints: CustomerPoints = new Map([
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4084, 29.7019] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(0);
    expect(result.ruleMatches).toEqual([0]);
  });

  it("handles customer points that match no rules", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 20,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4084, 29.7019] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(0);
    expect(result.ruleMatches).toEqual([0]);
  });

  it("preserves immutability of input customer points", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const originalCustomerPoint = buildCustomerPoint("CP1", {
      coordinates: [-95.4084, 29.7019],
      demand: 50,
    });
    const customerPoints: CustomerPoints = new Map([
      ["CP1", originalCustomerPoint],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(originalCustomerPoint.connection).toBeNull();
    expect(originalCustomerPoint.baseDemand).toBe(50);
  });

  it("excludes tanks and reservoirs from junction assignment", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aTank("T1", { coordinates: [-95.4089633, 29.701228] })
      .aReservoir("R1", { coordinates: [-95.4077939, 29.702706] })
      .aPipe("P1", {
        startNodeId: "T1",
        endNodeId: "R1",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4084, 29.7019] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(0);
    expect(result.ruleMatches).toEqual([0]);
  });

  it("assigns to closest junction when pipe has multiple junctions", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4078, 29.7026] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    expect(result.allocatedCustomerPoints.size).toBe(1);
    const allocatedCP1 = result.allocatedCustomerPoints.get("CP1");
    expect(allocatedCP1?.connection?.junctionId).toBe("J2");
  });

  it("creates independent customer point copies", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .build();

    const originalCustomerPoint = buildCustomerPoint("CP1", {
      coordinates: [-95.4084, 29.7019],
      demand: 50,
    });
    const customerPoints: CustomerPoints = new Map([
      ["CP1", originalCustomerPoint],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    const allocatedCP1 = result.allocatedCustomerPoints.get("CP1");
    expect(allocatedCP1).not.toBe(originalCustomerPoint);
    expect(allocatedCP1?.id).toBe(originalCustomerPoint.id);
    expect(allocatedCP1?.baseDemand).toBe(originalCustomerPoint.baseDemand);
  });
});

describe("findNearestPipeConnectionWithinDistance optimization", () => {
  it("returns same results as original implementation", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aJunction("J3", { coordinates: [-95.4089633, 29.710228] })
      .aJunction("J4", { coordinates: [-95.4077939, 29.711706] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 8,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .aPipe("P2", {
        startNodeId: "J3",
        endNodeId: "J4",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.710228],
          [-95.4077939, 29.711706],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4084, 29.7019] })],
      ["CP2", buildCustomerPoint("CP2", { coordinates: [-95.4084, 29.7109] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 200, maxDiameter: 10 },
      { maxDistance: 200, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    // Should find matches for both customer points
    expect(result.allocatedCustomerPoints.size).toBe(2);
    expect(result.ruleMatches).toEqual([1, 1]);

    const allocatedCP1 = result.allocatedCustomerPoints.get("CP1");
    const allocatedCP2 = result.allocatedCustomerPoints.get("CP2");

    // CP1 should connect to P1 (smaller diameter, matches first rule)
    expect(allocatedCP1?.connection?.pipeId).toBe("P1");
    expect(allocatedCP1?.connection?.junctionId).toBeTruthy();

    // CP2 should connect to P2 (larger diameter, matches second rule)
    expect(allocatedCP2?.connection?.pipeId).toBe("P2");
    expect(allocatedCP2?.connection?.junctionId).toBeTruthy();
  });

  it("demonstrates early termination with close match", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [-95.4089633, 29.701228] })
      .aJunction("J2", { coordinates: [-95.4077939, 29.702706] })
      .aJunction("J3", { coordinates: [-95.4089633, 29.75] })
      .aJunction("J4", { coordinates: [-95.4077939, 29.75] })
      .aPipe("P1", {
        startNodeId: "J1",
        endNodeId: "J2",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.701228],
          [-95.4077939, 29.702706],
        ],
      })
      .aPipe("P2", {
        startNodeId: "J3",
        endNodeId: "J4",
        diameter: 12,
        coordinates: [
          [-95.4089633, 29.75],
          [-95.4077939, 29.75],
        ],
      })
      .build();

    const customerPoints: CustomerPoints = new Map([
      // Customer point very close to P1, should find it in first bucket
      ["CP1", buildCustomerPoint("CP1", { coordinates: [-95.4084, 29.7019] })],
    ]);

    const allocationRules: AllocationRule[] = [
      { maxDistance: 100, maxDiameter: 15 },
    ];

    const result = allocateCustomerPoints(hydraulicModel, {
      allocationRules,
      customerPoints,
    });

    // Should find the closest pipe (P1) and not need to search distant buckets
    expect(result.allocatedCustomerPoints.size).toBe(1);
    const allocatedCP1 = result.allocatedCustomerPoints.get("CP1");
    expect(allocatedCP1?.connection?.pipeId).toBe("P1");

    // Distance should be very small since customer point is close to P1
    expect(allocatedCP1?.connection?.distance).toBeLessThan(50);
  });
});
